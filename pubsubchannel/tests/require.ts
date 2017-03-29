// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {makePatchingRequire} from "../patchRequire";
import * as assert from 'assert';

describe('patchRequire', function () {
    let originalRequire;
    before(() => {
        originalRequire = require('module').prototype.require;
    });

    afterEach(() => {
        require('module').prototype.require = originalRequire;
    })

    it('should produce a require-like function', function () {
        const patchedRequire = makePatchingRequire({});
        assert.strictEqual(patchedRequire('fs'), require('fs'), "Patched require did not return expected module")
    });

    it('should call a patching function if the version matches', function () {
        const fs = require('fs');
        const mock = {};
        const patchedRequire = makePatchingRequire({
            'fs': [{
                versionSpecifier: '>= 0.0.0',
                patch: function (originalModule) {
                    assert.strictEqual(originalModule, fs, 'Invoked with wrong package');
                    return mock;
                }
            }]
        });

        assert.strictEqual(patchedRequire('fs'), mock);
    });

    it('should not call a patching function if the version does not match', function () {
        const fs = require('fs');
        const patchedRequire = makePatchingRequire({
            'fs': [{
                versionSpecifier: '< 0.0.0',
                patch: function (originalModule) {
                    throw new Error("Patching function called with incorrect version");
                }
            }]
        });

        assert.strictEqual(patchedRequire('fs'), fs);
    });

    it('should call applicable patching functions in turn', function () {
        const fs = require('fs');
        const mock1 = {x:1};
        const mock2 = {x:2};
        const nodeVersion = process.version.substring(1);
        const patchedRequire = makePatchingRequire({
            fs: [{
                versionSpecifier: `< ${nodeVersion}`,
                patch: function (originalModule) {
                    throw new Error("Patching with wrong version");
                }
            },
            {
                versionSpecifier: `${nodeVersion}`,
                patch: function (originalModule) {
                    assert.equal(originalModule, fs);
                    return mock1;
                }
            },
            {
                versionSpecifier: `>= ${nodeVersion}`,
                patch: function (originalModule) {
                    assert.equal(originalModule, mock1, "Patching out of order!");
                    return mock2;
                }
            }]
        });

        assert.strictEqual(patchedRequire('fs'), mock2);
    });

    it('should be able to intercept global require if attached correctly', function () {
        const moduleModule = require('module');
        const mock = {};
        const patchedRequire = makePatchingRequire({
            'fs': [
                {
                    versionSpecifier: '>= 0.0.0',
                    patch: function (originalModule) {
                        return mock;
                    }
                }
            ]
        });

        moduleModule.prototype.require = patchedRequire;

        assert.strictEqual(require('fs'), mock, 'Global require did not return patched result');
    });

    it('should be able to patch non-built-in packages', function () {
        const moduleModule = require('module');
        const originalSemver = require('semver');
        const mock = {};
        const patchedRequire = makePatchingRequire({
            'semver': [{
                versionSpecifier: '>= 5.3.0 < 6.0.0',
                patch: function (originalModule) {
                    assert.equal(originalModule, originalSemver);
                    return mock;
                }
            }]
        });

        moduleModule.prototype.require = patchedRequire;
        assert.strictEqual(require('semver'), mock);
    });
})