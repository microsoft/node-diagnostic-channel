#! /bin/bash
# Helper script to compile/install the packages in the correct order
BASEDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
pushd $BASEDIR/src/diagnostic-channel
npm run clean && npm install && npm test
popd

pushd $BASEDIR/src/diagnostic-channel-publishers
npm run clean && npm install && npm test
popd


for x in `ls $BASEDIR/src/subs`; do
    if [ ! $x == ".gitignore" -a ! $x == "ai-subs" ]
    then
        pushd $BASEDIR/src/subs/$x
        npm run clean && npm install && npm test
        popd
    fi
done

pushd $BASEDIR/src/subs/ai-subs
npm install && npm test
popd

