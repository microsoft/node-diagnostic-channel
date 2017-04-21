#!/bin/bash #
# Helper script to compile/install the packages in the correct order
BASEDIR=$(dirname "$0")
pushd $BASEDIR/src/diagnostic-source
npm install && npm run clean && npm test
popd

for x in `ls $BASEDIR/src/pubs`; do
    pushd $BASEDIR/src/pubs/$x
    npm install && npm run clean && npm test
    popd
done

for x in `ls $BASEDIR/src/subs`; do
    if [ ! $x == ".gitignore" ]
    then
        pushd $BASEDIR/src/subs/$x
        npm install && npm test
        popd
    fi
done
