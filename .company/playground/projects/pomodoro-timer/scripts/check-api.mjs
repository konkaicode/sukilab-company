const r1 = await import('../api/health.js').catch(e => e.message);
const r2 = await import('../api/todos/[date].js').catch(e => e.message);
const r3 = await import('../api/todos/[date]/[id].js').catch(e => e.message);
const r4 = await import('../api/sessions/[date].js').catch(e => e.message);
console.log('health:                 ', typeof r1.default === 'function' ? 'OK' : r1);
console.log('todos/[date]:           ', typeof r2.default === 'function' ? 'OK' : r2);
console.log('todos/[date]/[id]:      ', typeof r3.default === 'function' ? 'OK' : r3);
console.log('sessions/[date]:        ', typeof r4.default === 'function' ? 'OK' : r4);
