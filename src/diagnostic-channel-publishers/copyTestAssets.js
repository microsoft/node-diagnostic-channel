// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
var fs = require("fs");
var path = require("path");

var sourcePath = path.join(__dirname, "tests", "util");
var destPath = path.join(__dirname, "dist", "tests", "util");

fs.readdir(sourcePath, (err, files) => {
    if (err) {
        throw err;
    }

    files.forEach((file) => {
        if (file.match(/\.json/) || file.match(/\.tsv/)) {
            fs.readFile(path.join(sourcePath, file), (err, buffer) => {
                if (err) {
                    throw err;
                }

                fs.writeFile(path.join(destPath, file), buffer, (err) => {
                    if (err) {
                        throw err;
                    }
                });
            });
        }
    });
});
