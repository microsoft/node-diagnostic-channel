var gulp = require('gulp');
var fs = require('fs');
var cp = require('child_process');
var path = require('path');
var util = require('util');

function getDirectories() {
    return [
        './src/diagnostic-channel',
        './src/diagnostic-channel-publishers',
        './src/publisher-legacy-tests/mongo2',
        './src/publisher-legacy-tests/mongo3.0.5',
        './src/publisher-legacy-tests/pg6'
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

function runNpmTasks(taskName, dirs) {
    for (var i = 0; i < dirs.length; i++) {
        var rc = runNpmTask(taskName, dirs[i]);
        if (rc !== 0) {
            throw new Error(`$Error: command \`${taskName}\` in directory ${dirs[i]} failed with return code ${rc}`);
        }
    }
}

gulp.task('install-main', function () {
    runNpmTask('link', './src/diagnostic-channel');
    runNpmTask('link diagnostic-channel', './src/diagnostic-channel-publishers');
    runNpmTask('install', './src/diagnostic-channel-publishers');
    runNpmTask('install', './src/diagnostic-channel');
    runNpmTask('install', './src/publisher-legacy-tests/mongo2');
    runNpmTask('install', './src/publisher-legacy-tests/mongo3.0.5');
    runNpmTask('install', './src/publisher-legacy-tests/pg6');
});

gulp.task('build-main', ['install-main'], function () {
    runNpmTasks('run build', getDirectories())
});

gulp.task('clean', function () {
    runNpmTasks('run clean', getDirectories());
});

gulp.task('install-subs', ['build-main'], function () {
    // runNpmTasks('link diagnostic-channel', getAdditionalDirectories());
    // runNpmTasks('link diagnostic-channel-publishers', getAdditionalDirectories());
    runNpmTasks('install', getAdditionalDirectories());
});

gulp.task('build-subs', ['install-subs'], function () {
    runNpmTasks('run build', getAdditionalDirectories());
});

gulp.task('init', ['build-subs']);

gulp.task('test', ['build-main'], function () {
    runNpmTasks('run test', getDirectories());
});

gulp.task('lint', function () {
    runNpmTasks('run lint', getDirectories().concat(getAdditionalDirectories()));
});
