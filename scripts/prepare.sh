#! /bin/bash
# Helper script to compile/install the packages in the correct order
BASEDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
pushd $BASEDIR/src/diagnostic-source
npm install
popd

for x in `ls $BASEDIR/src/pubs`; do
    pushd $BASEDIR/src/pubs/$x
    npm install
    popd
done

for x in `ls $BASEDIR/src/subs`; do
    if [ ! $x == ".gitignore" -a ! $x == "ai-subs" ]
    then
        pushd $BASEDIR/src/subs/$x
        npm install
        popd
    fi
    pushd $BASEDIR/src/subs/ai-subs
    npm install
    popd
done
