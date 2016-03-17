var chalk = require('chalk');
var gutil = require('gulp-util');
var toposort = require('toposort');

module.exports = {
    init: preprocessTopoInitializor,
    merger: preprocessTopoMerger
};

/**
 * Initializes preprocess options and sorts dependencies.
 * This function adds a new property called `preprocessFeatures` holding an array of first level preprocess option keys.
 *
 * **Note:** Dependencies are read from `preprocessDependencies` property.
 *
 * @param {Object} config - The default or custom config to be initialized.
 */
function preprocessTopoInitializor(config) {
    var preprocess = config.preprocess;
    var dependencies = config.preprocessDependencies;
    var features = Object.keys(preprocess);
    var edges;

    if(dependencies) {
        edges = hashToEdges(dependencies, preprocess, true);
        features = toposort.array(features, edges).reverse();
    }

    config.preprocessFeatures = features;

    gutil.log(chalk.green('Init preprocess features.'));
}

/**
 * Merges preprocess options through complementing with a default config file and sorts dependencies.
 * This function adds a new property called `preprocessFeatures` holding an array of first level preprocess option keys.
 *
 * **Note:** Dependencies are read from `preprocessDependencies` property.
 *
 * @param {Object} config - The new config to be merged with defaultConfig.
 * @param {Object} defaultConfig - The default config used to complement the new config.
 */
function preprocessTopoMerger(config, defaultConfig) {
    var preprocess = config.preprocess;
    var preprocessDefault = defaultConfig.preprocess;
    var dependencies = defaultConfig.preprocessDependencies;
    var features;
    var edges;
    var edge;
    var node;
    var dep;
    var i, edgesLength;
    var resolved = [];
    var path;
    var pathLength, j;
    var preprocessDefaultTraverse;
    var featureFound;
    var featureHash;
    var featureHashItem;

    // resolve dependant properties
    if(dependencies) {
        edges = hashToEdges(dependencies, preprocess);

        for (i = 0, edgesLength = edges.length; i < edgesLength; i++) {
            edge = edges[i];
            node = edge[0];

            // dependencies could be an object path -> needs to be traversed
            path = edge[1].split('.');
            featureFound = true;
            featureHash = {};
            featureHashItem = featureHash;
            preprocessDefaultTraverse = preprocessDefault;

            for(j=0, pathLength = path.length; j < pathLength; j++) {
                dep = path[j];

                // check if feature exists
                if(!(dep in preprocessDefaultTraverse)) {
                    featureFound = false;
                    break;
                }

                preprocessDefaultTraverse = preprocessDefaultTraverse[dep];

                // create feature object
                if(j < pathLength-1) {
                    featureHashItem[dep] = {};
                    featureHashItem = featureHashItem[dep];
                }
                // set last property to true
                else {
                    featureHashItem[dep] = true;
                }
            }

            // feature is available -> add it
            if(featureFound) {
                // reset dep
                dep = path[0];

                // if feature A is set but feature b is not set -> add it
                if (preprocess[node] && !preprocess[dep]) {
                    // if all feature are enabled -> add them all
                    if(typeof featureHash[dep] === 'boolean') {
                        preprocess[dep] = preprocessDefault[dep];
                    }
                    // else just add those who are specified
                    else {
                        preprocess[dep] = featureHash[dep];
                    }
                }
                // if feature b is set but an object, they need to be merged
                else if(preprocess[node] && typeof featureHash[dep] !== 'boolean') {
                    featureHashItem = featureHash;
                    featureHash = preprocess;

                    for(j=0, pathLength = path.length; j < pathLength; j++) {
                        dep = path[j];

                        // make that properties are merge even if object does not has the dep property at the moment.
                        if(j < pathLength-1 && dep in featureHash) {
                            featureHash = featureHash[dep];
                            featureHashItem = featureHashItem[dep];
                        }
                        else {
                            featureHash[dep] = featureHashItem[dep];
                            break;
                        }
                    }
                }

                // only rerun loop if edge has been added
                // this needs to be done to make really sure everything is where it should be
                if(preprocess[node]) {
                    // cache resolved items - just for logging
                    resolved.push(edge[1]);

                    // restart loop after dependency is resolved, because itself could depend on another feature
                    edges.splice(i, 1);
                    edgesLength = edges.length;

                    i = -1;
                }
            }
        }
    }

    // set features
    features = Object.keys(preprocess);
    if(dependencies) {
        edges = hashToEdges(dependencies, preprocess, true);

        features = toposort.array(features, edges).reverse();
    }

    config.preprocessFeatures = features;

    gutil.log(chalk.green('Resolved ') + chalk.yellow(resolved.length) + chalk.green(' Dependencies: ') + chalk.yellow(resolved.join(chalk.green(', '))));
}

/**
 * A hash containing features and their respective dependencies.
 *
 * **Note:** This has also build in support for conditional dependencies.
 *
 * @typedef {Object.<string, Array.<string|{condition: string, value: string}>>} DependenciesHash
 */

/**
 * Turns a preprocessDependencies hash in an array of edges, consumable by toposort algorithm.
 *
 * **Note:** This has also build in support for conditional dependencies.
 *
 * @param {DependenciesHash} hash - The preprocessDependencies hash.
 * @param {Object} preprocess - The preprocess config object.
 * @param {boolean} [firstLevelOnly=false] - Whether or not the node should only contain the first level of an object path.
 * @returns {Array}
 */
function hashToEdges(hash, preprocess, firstLevelOnly) {
    if(!hash) return;

    var keys = Object.keys(hash);
    var edges = [];
    var key;
    var deps;
    var dep;
    var condition;
    var conditionOK;
    var value;
    var i, l, j, k;
    var stack = [];
    var stackLength = 0;
    var plate;

    for(i=0, l=keys.length; i<l; i++) {
        key = keys[i];
        deps = hash[key];

        for(j=0, k=deps.length; j<k; j++) {
            dep = deps[j];

            if(Array.isArray(dep)) {
                stack.push({
                    j: j,
                    k: k,
                    deps: deps
                });
                ++stackLength;

                deps = dep;
                j=-1;
                k=dep.length;

                continue;
            }
            else
            // check conditional dependency
            if(typeof dep === 'object') {
                condition = dep.condition;
                conditionOK = checkCondition(condition, preprocess);

                // if feature is disabled -> continue
                if(conditionOK) {
                    value = dep.value;

                    if(typeof value === 'string') {
                        if(firstLevelOnly) {
                            value = value.split('.')[0];
                        }
                        edges.push([key, value]);
                    }

                    else if(Array.isArray(value)) {
                        stack.push({
                            j: j,
                            k: k,
                            deps: deps
                        });
                        ++stackLength;

                        deps = value;
                        j=-1;
                        k=value.length;

                        continue;
                    }
                }
            }
            else if(typeof dep === 'string') {
                if(firstLevelOnly) {
                    dep = dep.split('.')[0];
                }
                edges.push([key, dep]);
            }

            // make sure to pop stack back if end of current stack
            while(j === k-1 && stackLength) {
                plate = stack.pop();
                --stackLength;

                deps = plate.deps;
                j = plate.j;
                k = plate.k;
            }
        }
    }

    return edges;
}

function checkCondition(condition, preprocess) {
    var isConditionOK = false;
    var i, l;

    if(Array.isArray(condition)) {
        for(i=0, l=condition.length; i<l; i++) {
            if((isConditionOK = checkSingleCondition(condition[i], preprocess))) {
                break;
            }
        }
    }
    else if(typeof condition === 'string') {
        isConditionOK = checkSingleCondition(condition, preprocess);
    }

    return isConditionOK;
}

function checkSingleCondition(propertyPath, config) {
    var properties = propertyPath.split('.');
    var property;
    var i= 0, l=properties.length;
    var checkConfig = config;

    for(; i<l; i++) {
        property = properties[i];

        if( typeof checkConfig === 'object' ) {
            if (!(property in checkConfig) || checkConfig[property] === false) {
                return false;
            }

            checkConfig = checkConfig[property];
        }
        else {
            return checkConfig === true;
        }
    }

    return true;
}