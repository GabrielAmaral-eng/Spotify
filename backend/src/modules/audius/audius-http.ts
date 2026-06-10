import axios from 'axios';

// Ignora proxies herdados do ambiente local para evitar que chamadas ao Audius
// sejam desviadas para proxies invalidos durante o desenvolvimento.
export const audiusHttp = axios.create({
  proxy: false
});
