var gulp = require('gulp');
var fs = require('fs');
var cp = require('child_process');
var path = require('path');
var util = require('util');

function getDirectories() {
    return [
        './src/diagnostic-channel',
        './src/diagnostic-channel-publishers',
        './src/publisher-legacy-tests/pg6',
        './src/publisher-legacy-tests/winston2',
        './src/publisher-legacy-tests/mongo3.1.13',
        './src/publisher-legacy-tests/mongo3.2.7',
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

gulp.task('install-main', gulp.series(function (done) {
    runNpmTask('link', './src/diagnostic-channel');
    runNpmTask('link diagnostic-channel', './src/diagnostic-channel-publishers');
    runNpmTask('install', './src/diagnostic-channel-publishers');
    runNpmTask('install', './src/diagnostic-channel');
    runNpmTask('install', './src/publisher-legacy-tests/winston2');
    runNpmTask('install', './src/publisher-legacy-tests/mongo3.1.13');
    runNpmTask('install', './src/publisher-legacy-tests/mongo3.2.7');
    runNpmTask('install', './src/publisher-legacy-tests/pg6');
    done();
}));

gulp.task('build-main', gulp.series('install-main', function (done) {
    runNpmTasks('run build', getDirectories());
    done();
}));

gulp.task('clean', gulp.series(function (done) {
    runNpmTasks('run clean', getDirectories());
    done();
}));

gulp.task('install-subs', gulp.series('build-main', function (done) {
    // runNpmTasks('link diagnostic-channel', getAdditionalDirectories());
    // runNpmTasks('link diagnostic-channel-publishers', getAdditionalDirectories());
    runNpmTasks('install', getAdditionalDirectories());
    done();
}));

gulp.task('build-subs', gulp.series('install-subs', function (done) {
    runNpmTasks('run build', getAdditionalDirectories());
    done();
}));

gulp.task('init', gulp.series('build-subs'));

gulp.task('test', gulp.series('build-main', function (done) {
    runNpmTasks('run test', getDirectories());
    done();
}));

gulp.task('lint', function (done) {
    runNpmTasks('run lint', getDirectories().concat(getAdditionalDirectories()));
    done();
});
