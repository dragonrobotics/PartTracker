/* convenience functions for routing and API functions */
var express = require('express');
var monk = require('monk');
var csv = require('csv');

var Item = require('api/models/Item.js');
var Reservation = require('api/models/Reservation.js');

var winston = require('winston');

var APIClientError = function(errorCode, message) {
    this.name = 'APIClientError';
    this.message = message;
    this.resCode = errorCode;
    this.stack = (new Error()).stack;
};

APIClientError.prototype = new Error;

module.exports = {
    APIClientError: APIClientError,

    asyncMiddleware: function(fn) {
      return function(req, res, next) {
        Promise.resolve(fn(req, res, next))
          .catch(module.exports.apiErrorHandler(req, res));
      };
    },

    parseCSV: function(text) {
        return new Promise((resolve, reject) => {
            csv.parse(
                text,
                { columns: true, auto_parse: true },
                (err, parsedData) => {
                    if(err) return reject(err);
                    return resolve(parsedData);
                }
            );
        });
    },

    sendCSV: function(res, objects, columns, filename) {
        return new Promise((resolve, reject) => {
            csv.stringify(
                objects,
                {
                    columns: columns,
                    header: true,
                    formatters: {
                        date: (d) => d.toISOString()
                    },
                },
                (err, data) => {
                    if(err) return reject(err);

                    res.set('Content-Disposition', `attachment; filename="${filename}"`);
                    res.status(200).type('text/csv').send(data);
                    return resolve();
                }
            );
        });
    },

    /* Tests for the existence of given keys in req.body.
     * Returns a rejection promise if a key is not found,
     *  otherwise returns a fulfilled promise.
     */
    checkRequestParameters: function (req) {
        var params = Array.prototype.slice.call(arguments, 1);
        for(let param of params) {
            if(!(param in req.body))
                return Promise.reject("Missing parameter: \'"+param+"\'");
        }
        return Promise.resolve();
    },

    /* Catch handler for API handler functions using promises. */
    apiErrorHandler: function (req, res) {
        return (function (req, res, err) {
            if(err instanceof module.exports.APIClientError) {
                res.status(err.resCode);
                res.send(err.message);
                winston.log('error', "Error "+err.resCode.toString()+" on "+req.method+" request to "+req.originalUrl+" from "+req.socket.remoteAddress+":\n"+err.message);
            } else if(err instanceof Error) {
                res.status(500);
                res.send(err.stack);
                winston.log('error', "Error on "+req.method+" request to "+req.originalUrl+" from "+req.socket.remoteAddress+":\n"+err.stack);
            } else {
                res.status(400);
                res.send(err.toString());
                winston.log('error', "Error on "+req.method+" request to "+req.originalUrl+" from "+req.socket.remoteAddress+":\n"+err.toString());
            }
        }).bind(this, req, res);
    },

    /* Sends an object as JSON along with a given response code.
     * If the incoming object is an Item or a Reservation,
     * then it will be converted to a summary before being sent. */
    sendJSON: function(r, c) {
        return (function (res, stat, obj) {
            if(obj instanceof Item || obj instanceof Reservation) {
                return obj.summary().then(
                    (summ) => {
                        res.status(stat).json(summ);
                    }
                );
            } else {
                res.status(stat).json(obj);
            }
        }).bind(this, r, c);
    },

    jsonSuccess: function (r) {
        return module.exports.sendJSON(r, 200);
    },

    emptySuccess: function (r) {
        return (function (res) {
            res.status(204).end();
        }).bind(this, r);
    },
}
