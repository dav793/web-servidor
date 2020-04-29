
const net = require('net');
const Rx = require('rxjs');
const RxOp = require('rxjs/operators');

const logger = require('./lib/winston');
const util = require('./modules/shared/util');
const env = require('./config/environment');

// create server and define procedure on new connection
const server = net.createServer(conn => {

    const clientAddress = util.getSocketRemoteAddr(conn);

    // on data received through socket, enqueue data
    const dataStream$ = new Rx.Subject();
    conn.on('data', data => dataStream$.next(data));

    dataStream$.pipe(
        RxOp.concatMap(data => Rx.of(data))
    ).subscribe(
        data => {
            // when a request is processed

            const request = util.parseRequest(data.toString());
            logRequest(request);

            const response = util.createResponse(request);
            logResponse(response);

            conn.write(util.responseToBuffer(response));
            conn.end();

        },
        err => { throw err; },
        () => {}
    );

    // on error
    conn.on('error', err => {
        throw err;
    });

    // on timeout
    util.handleSocketTimeout(conn, () => {
        logger.debug({message: `connection with ${clientAddress} timed out`});
    });

    // on socket ended by client
    conn.on('end', () => {});

});

server.on('error', err => {
    throw err;
});

server.listen(env.PORT, () => {
    logger.debug({message: `server bound on port ${env.PORT}`});
});

function logRequest(req) {
    logger.debug({req});
}

function logResponse(res) {
    let responseLog = res;
    if (res.body)
        responseLog = Object.assign({}, res, {
            body: res.body.length < 100 ? res.body.toString() : 'TOO LONG'
        });
    logger.debug({responseLog});
}
