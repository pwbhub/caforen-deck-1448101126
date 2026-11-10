'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validConfig, publicConfig } = require('../server');
test('accepts original application config fields',()=>assert.equal(validConfig({routes:[],brand:{name:'Test'},csv:{defaultMode:'original'}}),true));
test('rejects unexpected config shape',()=>{assert.equal(validConfig([]),false);assert.equal(validConfig({unexpected:true}),false);assert.equal(validConfig({routes:{}}),false)});
test('does not expose legacy admin key hash',()=>{const c={security:{maxAttempts:5,adminKey:{hash:'SECRET'}},brand:{name:'Caforen'}};const v=publicConfig(c);assert.equal(v.security.adminKey,undefined);assert.equal(c.security.adminKey.hash,'SECRET');});
