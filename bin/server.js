#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var express = require('express'),
    url = require('url'),
    path = require("path"),
    _ = require("underscore"),

    optimist = require("optimist"),



    ApkGenerator = require("../lib/apk-generator").ApkGenerator;

function env (key) {
  var i=0, max=arguments.length, value;
  for ( ; i < max; i++) {
    value = process.env[arguments[i]];
    if (value) {
      return value;
    }
  }
}

var argv = optimist
    .usage('Usage: $0 {OPTIONS}')
    .wrap(80)
    .option('buildDir', {
        alias: "d",
        desc: "Use this directory as the temporary project directory",
        default: env("STACKATO_FILESYSTEM_BUILD", "TMPDIR")
    })
    .option('cacheDir', {
        alias: "c",
        desc: "Use this directory as the directory to cache keys and apks",
        default: env("STACKATO_FILESYSTEM_CACHE", "TMPDIR")
    })
    .option('config-files', {
        desc: "Use this list of config files for configuration",
        default: process.env['CONFIG_FILES'] ||
                 path.join(__dirname, '../config/default.js')
    })
    .option('force', {
        alias: "f",
        desc: "Force the projects to be built every time, i.e. don't rely on cached copies",
        default: false
    })
    .option('port', {
        alias: "p",
        desc: "Use the specific port to serve. This will override process.env.PORT.",
        default: env("VCAP_APP_PORT", "PORT") || 8080
    })
    .option('help', {
        alias: "?",
        desc: "Display this message",
        boolean: true
    })
    .check(function (argv) {
        if (argv.help) {
            throw "";
        }

        if (!argv.buildDir) {
          throw "Must specify a build directory";
        }

        argv.buildDir = path.resolve(process.cwd(), argv.buildDir);
        argv.cacheDir = path.resolve(process.cwd(), argv.cacheDir);

    })
    .argv;

// Allow command line argument to overwrite previous env var
process.env['CONFIG_FILES'] = argv['config-files'];

require('../lib/config')(function (config) {
  var app = express();
  var appGenerator = function (request, response) {

    var generator = new ApkGenerator(argv.buildDir, argv.cacheDir, argv.force);

    var manifestUrl = request.query.manifestUrl;
    var appType = request.query.appType || "hosted";

    if (!manifestUrl) {    
      response.send("A manifestUrl param is needed", 400);
      return;
    }

    generator.generate(manifestUrl, null, appType, function (err, apkLoc) {
      if (err) {
	response.type("text/plain");
	response.send(err.toString(), 400);
	return;
      }
      response.status(200);
      response.type("application/vnd.android.package-archive");
      response.sendfile(apkLoc);
    });

  };


  app.get('/application.apk', appGenerator);

  var indexFile = function (request, response) {
    response.status(200);
    response.type("text/text");
    response.send("200 Server OK");
  };
  app.get("/", indexFile);
  app.get("/index.html", indexFile);


  var port = argv.port;
  var host = process.env.VCAP_APP_HOST || "127.0.0.1";

  console.log("running on " + host + ":" + port);

  app.listen(port);
});