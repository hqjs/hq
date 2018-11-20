const socket = new WebSocket(`ws://${location.host}`);

socket.addEventListener('message', event => {
  if (event.data === 'reload') window.location.reload();
});
