
const net = require('net');

const client = new net.Socket();
client.setTimeout(5000);

console.log("Checking port 5432 on db01.weldn.ai...");

client.connect(5432, 'db01.weldn.ai', function() {
    console.log('Successfully opened connection to port 5432');
    client.destroy();
});

client.on('error', function(err) {
    console.error('Connection error:', err.message);
    client.destroy();
});

client.on('timeout', function() {
    console.error('Connection timeout');
    client.destroy();
});
