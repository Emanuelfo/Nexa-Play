function logErro(evento, req, erro) {
  console.error(JSON.stringify({
    event: evento,
    request_id: req?.requestId,
    error: erro?.original?.code || erro?.parent?.code || erro?.name || "Error",
  }));
}

module.exports = logErro;
