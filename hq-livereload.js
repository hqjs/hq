const socket = new WebSocket(`ws${location.protocol === 'https:' ? 's' : ''}://${location.host}`);

socket.addEventListener('message', event => {
  if (event.data === 'reload') window.location.reload();
});
