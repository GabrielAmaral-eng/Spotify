import axios from 'axios';

// Ignora proxies herdados do ambiente local para evitar que chamadas ao Spotify
// sejam desviadas para proxies inválidos durante o desenvolvimento.
export const spotifyHttp = axios.create({
  proxy: false
});
