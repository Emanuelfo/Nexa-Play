const crypto = require("node:crypto");
const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");

const WINDOW_MS = 60 * 1000;

function hashKey(value) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update(value).digest("hex");
}

async function initializeRateLimitStore() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS public.api_rate_limit_windows (
      bucket_key char(64) PRIMARY KEY,
      hit_count integer NOT NULL CHECK (hit_count > 0),
      reset_at timestamptz NOT NULL
    )
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_api_rate_limit_windows_reset_at
    ON public.api_rate_limit_windows (reset_at)
  `);
  await sequelize.query("ALTER TABLE public.api_rate_limit_windows ENABLE ROW LEVEL SECURITY");
}

async function incrementBucket(scope, identifier, windowMs) {
  const bucketKey = hashKey(`${scope}:${identifier}`);
  const [bucket] = await sequelize.query(`
    INSERT INTO public.api_rate_limit_windows AS rate_limit (bucket_key, hit_count, reset_at)
    VALUES (
      :bucketKey,
      1,
      clock_timestamp() + CAST(:windowMs AS integer) * INTERVAL '1 millisecond'
    )
    ON CONFLICT (bucket_key) DO UPDATE
    SET hit_count = CASE
          WHEN rate_limit.reset_at <= clock_timestamp() THEN 1
          ELSE rate_limit.hit_count + 1
        END,
        reset_at = CASE
          WHEN rate_limit.reset_at <= clock_timestamp()
            THEN clock_timestamp() + CAST(:windowMs AS integer) * INTERVAL '1 millisecond'
          ELSE rate_limit.reset_at
        END
    RETURNING hit_count,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (reset_at - clock_timestamp()))))::integer AS retry_after
  `, {
    replacements: { bucketKey, windowMs },
    type: QueryTypes.SELECT,
  });
  if (!bucket) throw new Error("Rate-limit store did not return a counter.");
  return bucket;
}

function logStoreError(req, scope, error) {
  console.error(JSON.stringify({
    event: "rate_limit_store_error",
    request_id: req.requestId,
    scope,
    error: error.original?.code || error.parent?.code || error.name,
  }));
}

function createRateLimiter({ scope, windowMs = WINDOW_MS, maxIp, maxUser, maxIdentity, identity }) {
  if (!scope || !Number.isInteger(windowMs) || windowMs < 1000
    || ![maxIp, maxUser, maxIdentity].some(value => Number.isInteger(value) && value > 0)) {
    throw new TypeError("Invalid rate limiter configuration.");
  }

  return async function rateLimit(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const buckets = [];
    if (maxIp) buckets.push({ identifier: `ip:${ip}`, maximum: maxIp });
    if (maxUser && req.usuario?.id) {
      buckets.push({ identifier: `user:${req.usuario.id}`, maximum: maxUser });
    }
    if (maxIdentity && identity) {
      const value = identity(req);
      if (typeof value === "string" && value.trim()) {
        buckets.push({ identifier: `identity:${value.trim().toLowerCase().slice(0, 255)}`, maximum: maxIdentity });
      }
    }

    try {
      for (const bucket of buckets) {
        const result = await incrementBucket(scope, bucket.identifier, windowMs);
        if (result.hit_count > bucket.maximum) {
          const retryAfter = Math.max(1, Number(result.retry_after) || 1);
          res.setHeader("Retry-After", String(retryAfter));
          console.warn(JSON.stringify({
            event: "rate_limit_exceeded",
            request_id: req.requestId,
            scope,
            principal_hash: hashKey(bucket.identifier).slice(0, 16),
          }));
          return res.status(429).json({ mensagem: "Muitas tentativas. Aguarde um pouco e tente novamente." });
        }
      }
    } catch (error) {
      logStoreError(req, scope, error);
      return res.status(503).json({ mensagem: "A proteção contra abuso está temporariamente indisponível. Tente novamente." });
    }
    return next();
  };
}

async function cleanExpiredBuckets() {
  await sequelize.query(`
    DELETE FROM public.api_rate_limit_windows
    WHERE bucket_key IN (
      SELECT bucket_key
      FROM public.api_rate_limit_windows
      WHERE reset_at < clock_timestamp() - INTERVAL '1 hour'
      ORDER BY reset_at
      LIMIT 10000
    )
  `);
}

module.exports = { createRateLimiter, initializeRateLimitStore, cleanExpiredBuckets };
