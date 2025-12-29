const config = {
  method: 'GET'
};

function hello(ctx) {
  ctx.body = {
    message: 'Hello, MerryChristmas!',
    timestamp: new Date().toISOString(),
    path: ctx.path,
    method: ctx.method
  };
}