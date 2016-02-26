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
        edges = hashToEdges(dependencies);
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
    var i, l;
    var resolved = [];

    // resolve dependant properties
    if(dependencies) {
        edges = hashToEdges(dependencies);

        for (i = 0, l = edges.length; i < l; i++) {
            edge = edges[i];
            node = edge[0];
            dep = edge[1];

            if (preprocess[node] && !preprocess[dep]) {
                preprocess[dep] = preprocessDefault[dep];

                resolved.push(dep);

                edges.slice(i, 1);
                l--;
                i = -1;
            }
        }
    }

    // set features
    features = Object.keys(preprocess);
    if(dependencies) {
        edges = hashToEdges(dependencies);
        features = toposort.array(features, edges).reverse();
    }

    config.preprocessFeatures = features;

    gutil.log(chalk.green('Resolved ') + chalk.yellow(resolved.length) + chalk.green(' Dependencies: ') + chalk.yellow(resolved.join(chalk.green(', '))));
}

function hashToEdges(hash) {
    if(!hash) return;

    var keys = Object.keys(hash);
    var edges = [];
    var key;
    var deps;
    var i, l, j, k;

    for(i=0, l=keys.length; i<l; i++) {
        key = keys[i];
        deps = hash[key];

        for(j=0, k=deps.length; j<k; j++) {
            edges.push([key, deps[j]]);
        }
    }

    return edges;
}