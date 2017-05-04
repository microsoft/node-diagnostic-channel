#! /bin/bash
# Helper script to compile/install the packages in the correct order
BASEDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
pushd $BASEDIR/src/diagnostic-channel
npm install && npm run clean && npm test
popd

pushd $BASEDIR/src/diagnostic-channel-publishers
npm install && npm run clean && npm test
popd

for x in `ls $BASEDIR/src/subs`; do
    if [ ! $x == ".gitignore" ]
    then
        pushd $BASEDIR/src/subs/$x
        npm install && npm test
        popd
    fi
done
