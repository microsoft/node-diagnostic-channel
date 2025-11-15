var fs = require('fs');
var cp = require('child_process');
var path = require('path');
var util = require('util');

function getDirectories() {
    return [
        './src/diagnostic-channel',
        './src/diagnostic-channel-publishers',
        './src/publisher-legacy-tests/winston2',
        './src/publisher-legacy-tests/mongo3.2.7'
    ];
}

function getAdditionalDirectories() {
    return [
        './src/subs/bunyan-sub',
        './src/subs/console-sub',
        './src/subs/mongodb-sub',
        './src/subs/mysql-sub',
        './src/subs/redis-sub',
        './sample'];
}

/*
 * Synchronously run an npm task in a single directory.  Return error code of spawned process.
 */
function runNpmTask(taskName, directory) {

    console.log(`running ${taskName} in ${directory}`);

    var opts = {
        cwd: directory,
        env: process.env,
        stdio: 'inherit',
        shell: true
    };

    args = taskName.split(' ');

    var proc = cp.spawnSync('npm', args, opts);

    if (proc.error) {
        process.stderr.write(proc.error.toString());
    }

    return proc.status;
}

function runNpmTasks(taskName, dirs, continueOnError) {
    var failures = [];
    for (var i = 0; i < dirs.length; i++) {
        var rc = runNpmTask(taskName, dirs[i]);
        if (rc !== 0) {
            failures.push({ directory: dirs[i], returnCode: rc });
            if (!continueOnError) {
                throw new Error(`$Error: command \`${taskName}\` in directory ${dirs[i]} failed with return code ${rc}`);
            }
        }
    }
    
    if (failures.length > 0 && continueOnError) {
        console.error('\n========================================');
        console.error('SUMMARY: Some tasks failed:');
        failures.forEach(function(failure) {
            console.error(`  - ${taskName} in ${failure.directory} (exit code: ${failure.returnCode})`);
        });
        console.error('========================================\n');
        throw new Error(`${failures.length} task(s) failed. See summary above.`);
    }
}

module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
    });

    grunt.registerTask('install-sub', 'Install in sub directories.', function (arg1, arg2) {
        runNpmTasks('install', getAdditionalDirectories());
    });

    grunt.registerTask('install-main', 'Install in main directories.', function (arg1, arg2) {
        runNpmTask('link', './src/diagnostic-channel');
        runNpmTask('link diagnostic-channel', './src/diagnostic-channel-publishers');
        runNpmTask('install', './src/diagnostic-channel-publishers');
        runNpmTask('install', './src/diagnostic-channel');
        runNpmTask('install', './src/publisher-legacy-tests/winston2');
        runNpmTask('install', './src/publisher-legacy-tests/mongo3.2.7');
    });

    grunt.registerTask('build-sub', 'Build in sub directories.', function (arg1, arg2) {
        runNpmTasks('run build', getAdditionalDirectories());
    });

    grunt.registerTask('build-main', 'Build in main directories.', function (arg1, arg2) {
        runNpmTasks('run build', getDirectories());
    });

    grunt.registerTask('test-main', 'Test in main directories.', function (arg1, arg2) {
        runNpmTasks('run test', getDirectories(), true); // Continue on error to run all tests
    });

    grunt.registerTask('lint', 'Lint in all directories', function (arg1, arg2) {
        runNpmTasks('run lint', getDirectories().concat(getAdditionalDirectories()));
    });

    grunt.registerTask('clean', 'Clean main directories.', function (arg1, arg2) {
        runNpmTasks('run clean', getDirectories());
    });

    grunt.registerTask('init', ['install-main', 'build-main', 'install-sub', 'build-sub']);
    grunt.registerTask('build', ['install-main', 'build-main']);
    grunt.registerTask('test', ['build-main', 'test-main']);
    grunt.registerTask('lint', ['lint']);
    grunt.registerTask('clean', ['install-main', 'build-main']);

};