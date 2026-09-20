import test from 'node:test';
import assert from 'node:assert/strict';
import {parseYaml,stringifyYaml,expandEnvVars} from '../index.js';
test('parses nested tasks',()=>{const data=parseYaml('version: 1\n tasks:\n  - name: build\n    action: npm run build\n    enabled: true\n    env:\n      NODE_ENV: production\n      PORT: 3000\n    dependsOn:\n      - prepare\n'.replace(/^ /gm,''));assert.equal(data.version,1);assert.equal(data.tasks[0].name,'build');assert.equal(data.tasks[0].env.NODE_ENV,'production');assert.equal(data.tasks[0].env.PORT,3000);assert.deepEqual(data.tasks[0].dependsOn,['prepare'])});
test('round trips configuration',()=>{const input={version:1,tasks:[{name:'hello',action:'echo hello',enabled:true,env:{MODE:'test'}}]};assert.deepEqual(parseYaml(stringifyYaml(input)),input)});
test('expands variables',()=>assert.equal(expandEnvVars('build-'+'$'+'{ASCIYML_TEST}',{ASCIYML_TEST:'ok'}),'build-ok'));
