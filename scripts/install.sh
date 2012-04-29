#!/bin/sh -e

################################################################################
## Grab third-party resources first ############################################
################################################################################

# The --location means it follows 301, 302, and 303 redirects.
CURLCMD="curl --progress-bar --location"
TOPDIR=`pwd`

SITEDIR=$TOPDIR/site
mkdir $SITEDIR &> /dev/null || true

STATICDIR=$SITEDIR/static
mkdir $STATICDIR &> /dev/null || true

## JS ##########################################################################
# Store all the downloaded files in our static directory:
cd $STATICDIR
mkdir css &> /dev/null || true
mkdir js &> /dev/null || true

if [[ ! -f js/LAB.js ]]; then
    echo "Fetching LAB.js..."
    LABJS_URL=https://raw.github.com/getify/LABjs
    $CURLCMD $LABJS_URL/master/LAB.js > js/LAB.js
fi

if [[ ! -f js/jquery.js ]]; then
    echo "Fetching jquery files..."
    JQUERY_URL=http://code.jquery.com
    JQUERY_VERSION=1.7.1
    $CURLCMD $JQUERY_URL/jquery-$JQUERY_VERSION.js > js/jquery.js
fi

if [[ ! -f js/d3.js ]]; then
    echo "Fetching d3 files..."
    D3_URL=https://raw.github.com/mbostock/d3
    D3_SHA1=af2af6ac9080529d102aacfa57807371fd983d2b
    $CURLCMD $D3_URL/$D3_SHA1/d3.v2.js > js/d3.js
fi

if [[ ! -f js/underscore.js ]]; then
    echo "Fetching underscore.js..."
    UNDERSCORE_URL=http://documentcloud.github.com/underscore
    $CURLCMD $UNDERSCORE_URL/underscore.js > js/underscore.js
fi

if [[ ! -f js/crypto.js ]]; then
    echo "Fetching SHA-1 library..."
    CRYPTO_URL=http://crypto-js.googlecode.com/files
    CRYPTO_VERSION=2.5.3
    $CURLCMD $CRYPTO_URL/$CRYPTO_VERSION-crypto-sha1.js > js/crypto.js
fi


## Bootstrap ###################################################################
cd $SITEDIR
if [[ ! -d bootstrap ]]; then
    echo "Fetching, unzipping, and building Bootstrap..."
    BOOTSTRAP_URL=https://github.com/twitter/bootstrap/zipball/master
    $CURLCMD $BOOTSTRAP_URL > bootstrap.zip

    # Unzip the file, producing a directory like "twitter-bootstrap-d335adf":
    unzip -q bootstrap.zip
    rm bootstrap.zip

    # Move that directory to plain old "bootstrap", and enter it:
    mv twitter-bootstrap-* bootstrap
    cd bootstrap

    # And build the contents, for the JS file. We'll handle the less part later.
    make bootstrap
    cp bootstrap/js/* $STATICDIR/js
fi

# Don't forget to return us to that top-level directory.
cd $TOPDIR

################################################################################
## Copy our source into place ##################################################
################################################################################

## HTML ########################################################################
echo "Copying ChordWeb HTML..."
cp src/static/*.html $STATICDIR

## CSS #########################################################################
echo "Generating ChordWeb CSS..."
lessc --include-path="site/bootstrap/less" src/static/style.less \
        > $STATICDIR/css/style.css

## JS ##########################################################################
echo "Generating ChordWeb JS..."

# Make sure the Google Closure Compiler's available on the command line:
echo | closure &> /dev/null
if [[ $? -ne 0 ]]; then
    echo "Google Closure Compiler not found."
    exit 1
fi

# Run through all the client-side JS scripts
for FILE in `ls src/client/*.js`; do
    # Don't run the closure compile on npm start, for speed's sake.
    if [[ $npm_lifecycle_event != "prestart" ]]; then
        echo "Compiling $FILE..."
        cat $FILE | closure > site/static/js/`basename $FILE ".js"`-min.js
    fi

    # Copy the raw (dev) version of the file over, regardless:
    cp $FILE site/static/js/`basename $FILE`
done
