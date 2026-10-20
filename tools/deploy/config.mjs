import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('../../deploy/production.json',import.meta.url),'utf8'));
if(!/^[A-Z0-9]+$/.test(config.distributionId||''))throw Error('One-time AWS setup is incomplete: set distributionId in deploy/production.json. See docs/deployment.md.');
for(const [key,value] of Object.entries(config)){
 if(typeof value!=='string'||/[\r\n]/.test(value))throw Error('Invalid deployment setting: '+key);
 console.log(`${key}=${value}`);
}
