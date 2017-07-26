var gulp = require('gulp');
var fs = require('fs');
var cp = require('child_process');
var path = require('path');
var util = require('util');

function getDirectories() {
    return [
        './src/diagnostic-channel',
        './src/diagnostic-channel-publishers'];
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

function runNpmTasks(taskName, dirs, done) {
    for (var i = 0; i < dirs.length; i++) {
        var rc = runNpmTask(taskName, dirs[i]);
        if (rc !== 0) {
            done(util.format('Error.  command %s in directory %s failed with return code %d', taskName, dirs[i], rc));
            return;
        }
    }
    done();
}

gulp.task('link', function () {
    runNpmTask('link', './src/diagnostic-channel');
    runNpmTask('link diagnostic-channel', './src/diagnostic-channel');
});

gulp.task('install-main', ['link'], function (done) {
    runNpmTasks('install', getDirectories(), done);
});

gulp.task('build-main', ['install-main'], function (done) {
    runNpmTasks('run build', getDirectories(), done)
});

gulp.task('clean', function (done) {
    runNpmTasks('run clean', getDirectories(), done);
});

gulp.task('install-subs', ['build-main'], function (done) {
    runNpmTasks('install', getAdditionalDirectories(), done);
});

gulp.task('build-subs', ['install-subs'], function (done) {
    runNpmTasks('run build', getAdditionalDirectories(), done);
});

gulp.task('init', ['build-subs']);

gulp.task('test', function (done) {
    runNpmTasks('run test', getDirectories(), done);
});

gulp.task('lint', function (done) {
    runNpmTasks('run lint', getDirectories().concat(getAdditionalDirectories()), done);
});
