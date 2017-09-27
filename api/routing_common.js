/* convenience functions for routing and API functions */
var express = require('express');
var monk = require('monk');
var csv = require('csv');

var Item = require('api/models/Item.js');
var Reservation = require('api/models/Reservation.js');

var winston = require('winston');

var APIClientError = function(errorCode, message) {
    this.name = 'APIClientError';

    if(message === undefined) {
        // treat errorCode as the message and ignore the actual message parameter
        this.message = errorCode;
        this.resCode = 400; // default error code
    } else {
        this.message = message;
        this.resCode = parseInt(errorCode, 10);
    }
    this.stack = (new Error()).stack;
};

APIClientError.prototype = new Error;

module.exports = {
    APIClientError: APIClientError,

    asyncMiddleware: function(fn) {
      return function(req, res, next) {
        Promise.resolve(fn(req, res, next))
          .catch(next);
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

    sendCSV: function(res, objects, filename, columns) {
        // Autodetermine column names if necessary
        columns = columns || Object.getOwnPropertyNames(objects[0]);

        return new Promise((resolve, reject) => {
            csv.stringify(
                objects,
                {
                    columns: columns,
                    header: true,
                    formatters: {
                        bool: (b) => b ? 'true' : 'false',
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
                return Promise.reject(new APIClientError("Missing parameter: \'"+param+"\'"));
        }
        return Promise.resolve();
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
