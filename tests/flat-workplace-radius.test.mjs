import assert from 'node:assert/strict';
import test from 'node:test';
import {useFlatFilters} from '../app/composables/flats/useFlatFilters.ts';
import {useFlatRouteState} from '../app/composables/flats/useFlatRouteState.ts';
import {normalizeSearchCenter, normalizeSearchRadius} from '../app/utils/flats/searchRadius.ts';

const params = (filters) => filters.buildFeedParams({limit:20,append:false,loadedCount:0,nextCursor:null,sources:['olx','telegram']});
const route = (filters) => useFlatRouteState({router:{replace:async()=>{}},route:{query:{}},filters,sources:['olx','telegram']});

test('workplace radius travels to the server before pagination, including zero coordinates', () => {
  const filters=useFlatFilters();
  filters.countries.value=['UA'];
  filters.radiusCenter.value={lat:0,lng:0};
  filters.radiusM.value=12500;
  assert.equal(params(filters).centerLat,'0');
  assert.equal(params(filters).centerLng,'0');
  assert.equal(params(filters).radiusM,'12500');
  assert.equal(params(filters).countries,'UA');
});

test('radius is absent when no center is selected or coordinates are invalid', () => {
  const filters=useFlatFilters();
  assert.equal(params(filters).radiusM,undefined);
  for(const center of [{lat:91,lng:0},{lat:0,lng:181},{lat:NaN,lng:0},{lat:0,lng:Infinity}]){
    filters.radiusCenter.value=center;
    assert.equal(params(filters).centerLat,undefined);
    assert.equal(params(filters).radiusM,undefined);
  }
});

test('workplace parameters round-trip through the current route without losing metro or share state', () => {
  const filters=useFlatFilters();
  const state=route(filters);
  state.deserialize({countries:'UA',city:'Kyiv',centerLat:'50.45',centerLng:'30.52',radiusM:'7500',metro:'Obolon',metroMaxM:'800'});
  assert.deepEqual(filters.radiusCenter.value,{lat:50.45,lng:30.52});
  assert.equal(filters.radiusM.value,7500);
  assert.equal(filters.metroMaxM.value,800);
  assert.equal(state.serialize().centerLat,'50.45');
  assert.equal(state.serialize().radiusM,'7500');
  state.deserialize({countries:'UA',city:'Kyiv'});
  assert.equal(filters.radiusCenter.value,null);
  assert.equal(state.serialize().radiusM,undefined);
});

test('restoration rejects malformed centers and bounds the radius instead of trusting the URL', () => {
  const filters=useFlatFilters();
  const state=route(filters);
  for(const value of [{centerLat:'',centerLng:'0'},{centerLat:'0'},{centerLat:'100',centerLng:'0'},{centerLat:'0',centerLng:'NaN'}]){
    state.deserialize(value);
    assert.equal(filters.radiusCenter.value,null);
  }
  for(const [input,expected] of [['-1',5000],['0',5000],['NaN',5000],['50',500],['999999',30000],['1200',1200]]){
    state.deserialize({centerLat:'0',centerLng:'0',radiusM:input});
    assert.equal(filters.radiusM.value,expected);
    assert.equal(state.serialize().radiusM,String(expected));
  }
  assert.equal(normalizeSearchCenter({lat:false,lng:0}),null);
  assert.equal(normalizeSearchRadius(null),5000);
});

test('changing city or country and resetting filters clears the workplace radius synchronously', () => {
  const filters=useFlatFilters();
  filters.countries.value=['UA'];
  filters.city.value='Kyiv';
  for(const change of [()=>{filters.city.value='Odesa';},()=>{filters.countries.value=['RO'];},()=>filters.resetValues('RO')]){
    filters.radiusCenter.value={lat:50.45,lng:30.52};filters.radiusM.value=12000;
    change();
    assert.equal(filters.radiusCenter.value,null);
    assert.equal(filters.radiusM.value,5000);
  }
});
