var monk = require('monk');
var ObjectID = require('mongodb').ObjectID;
var dbAPI = require('api/db.js');
var winston = require('winston');
var type = require('type-detect');

var Item = function (id) {
    dbAPI.DatabaseItem.call(this, dbAPI.inventory, id);
};

Item.prototype = Object.create(dbAPI.DatabaseItem.prototype);
Item.prototype.constructor = Item;

Item.prototype.delete = async function () {
    /* Remove Reservations referencing this item */
    winston.log('info', 'Deleted object %s from %s collection.',
        this.id().toString(), this.db.name,
        {
            id: this.id().toString(),
            collection: this.db.name
        }
    );

    return dbAPI.reservations.remove({part: this.id()}).then(
        /* Now remove this item */
        () => { return dbAPI.inventory.remove({_id: this.id()}); }
    );
};

/* Get / Set item name and total inventory count... */
Item.prototype.name = async function(v) {
    if(type(v) === 'string') {
        return this.prop('name', v);
    } else if(v === undefined) {
        var t = await this.prop('name');
        if(t === null || type(t) === 'string') return t;

        throw new Error("Got non-string value for Item.name() from database!");
    } else {
        throw new Error("Item.name() value must be a string!");
    }
};

Item.prototype.count = async function(v) {
    if(type(v) === 'string' && !isNaN(parseInt(v, 10))) {
        return this.prop('count', parseInt(v, 10));
    } else if(type(v) === 'number') {
        return this.prop('count', v);
    } else if(v === undefined) {
        var t = await this.prop('count');

        if(t === null || type(t) === 'number') return t;
        else if(type(t) === 'string' && !isNaN(parseInt(t, 10))) return parseInt(t, 10);

        throw new Error("Got non-numerical, non-null value for Item.count() from database!");
    } else {
        throw new Error("Item.count() value must be a numerical value (parsable string or number)!");
    }
};

/* Get number of reserved units for this item */
Item.prototype.reserved = function () {
    return dbAPI.reservations.aggregate([
        { $match: { part: this.id() } },
        { $group: { _id: null, reserved: { $sum: "$count" } } }
    ]).then(
        (doc) => {
            if(doc[0] === undefined) {
                return 0;
            }

            ret = parseInt(doc[0].reserved);
            if(ret !== ret) {
                return 0;
            } else {
                return ret;
            }
        }
    );
};

/* Get number of available units for this item */
Item.prototype.available = function () {
    return Promise.all([
        this.count(),
        this.reserved()
    ]).then(
        (retn) => {
            return retn[0] - retn[1];
        }
    );
};

Item.prototype.summary = function () {
    return this.fetch().then(
        () => {
            return Promise.all([
                this.name(),
                this.count(),
                this.reserved(),
                this.created(),
                this.updated(),
            ]);
        }
    ).then(
        (retn) => {
            return {
                id: this.id(),
                name: retn[0],
                count: retn[1],
                reserved: retn[2],
                available: retn[1] - retn[2],
                created: retn[3],
                updated: retn[4]
            };
        }
    );
};

Item.prototype.reservations = function () {
    return dbAPI.reservations.find({part: this.id()}, {}).then(
        (docs) => {
            return docs.map((doc) => { return doc._id; });
        }
    );
};

module.exports = Item;
