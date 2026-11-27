/* Antecipa a verificação de sessão (GET /api/me) das páginas que dependem dela (área logada e login):
   a chamada corre em paralelo ao download e à execução do main.js, em vez de começar só depois dele.
   O main.js consome esta promessa uma única vez (NP._boot); depois disso, loadUser() volta ao normal. */
if (typeof NP !== 'undefined') NP._boot = NP.loadUser();
