var express = require('express');
var monk = require('monk');
var bodyParser = require('body-parser');

var dbAPI = require('api/db.js');
var common = require('api/routing_common.js');

var User = require('api/models/User.js');

var router = express.Router();
router.use(bodyParser.json());

router.get('/user',
    (req, res) => {
        req.user.summary().then(common.jsonSuccess(res)).catch(common.apiErrorHandler(req, res));
    }
);

router.post('/user/password',
    (req, res) => {
        req.user.setPassword(req.body.password).then(
            () => { req.logout(); }
        ).then(common.emptySuccess(res)).catch(common.apiErrorHandler(req, res));
    }
)

/* The /users endpoints are restricted to administrators only. */
router.use('/users',
    (req, res, next) => {
        req.user.admin().then(
            (isAdmin) => {
                if(isAdmin) { next(); }
                else { res.status(401).send("This endpoint is restricted to administrators."); }
            }
        );
    }
);

/* Get listing of all users. */
router.get('/users',
    (req, res) => {
        dbAPI.users.find({}, {}).then(
            (docs) => {
                promises = docs.map(
                    (doc) => {
                        user = new User(doc._id);
                        return user.summary();
                    }
                );

                return Promise.all(promises);
            }
        ).then(common.jsonSuccess(res)).catch(common.apiErrorHandler(req, res));
    });

/* Add a new user.
 * Required parameters (all self-explanatory):
 *  username [string]
 *  password [string]
 *  realname [string]
 *  admin [boolean]
 *  disabled [boolean]
 */
router.post('/users',
    (req, res) => {
        common.checkRequestParameters(req, 'username', 'password', 'realname', 'admin', 'disabled').then(
            () => {
                var user = new User();

                user.username(req.body.username);
                user.realname(req.body.realname);
                user.admin(req.body.admin);
                user.disabled(req.body.disabled);

                return user.setPassword(req.body.password).then( () => { return user.save(); } );
            }
        ).then(
            (user) => { return user.summary(); }
        ).then(common.jsonSuccess(res)).catch(common.apiErrorHandler(req, res));
    }
);

router.use('/users/:uid',
    (req, res, next) => {
        /* Get the referenced user object already */
        user = new User(monk.id(req.params.uid));

        user.exists().then(
            (exists) => {
                if(!exists) {
                    return Promise.reject("User not found in database.");
                }
                req.targetUser = user;
                next();
            }
        ).catch(common.apiErrorHandler(req, res));
    }
);

router.get('/users/:uid',
    (req, res) => {
        req.targetUser.summary().then(common.jsonSuccess(res)).catch(common.apiErrorHandler(req, res));
    }
);

router.put('/users/:uid',
    (req, res) => {
        common.checkRequestParameters(req, 'username', 'realname', 'admin', 'disabled').then(
            () => {
                req.targetUser.username(req.body.username);
                req.targetUser.realname(req.body.realname);
                req.targetUser.admin(req.body.admin);
                req.targetUser.disabled(req.body.disabled);

                return req.targetUser.save();
            }
        ).then(
            () => { return req.targetUser.summary(); }
        ).then(common.jsonSuccess(res)).catch(common.apiErrorHandler(req, res));
    }
);

router.delete('/users/:uid',
    (req, res) => { req.targetUser.delete().then(common.emptySuccess(res)).catch(common.apiErrorHandler(req, res)); }
);

router.post('/users/:uid/password',
    (req, res) => {
        common.checkRequestParameters(req, 'password').then(
            () => { return req.targetUser.setPassword(req.body.password); }
        ).then(
            () => { return req.targetUser.save(); }
        ).then(
            () => { return req.targetUser.summary(); }
        ).then(common.jsonSuccess(res)).catch(common.apiErrorHandler(req, res));
    }
);

module.exports = router;
