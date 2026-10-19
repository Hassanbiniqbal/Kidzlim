import * as migration_20261012_065234_initial from './20261012_065234_initial';
import * as migration_20261013_094049_phase2_storefront from './20261013_094049_phase2_storefront';
import * as migration_20261013_124515_phase3_page_count from './20261013_124515_phase3_page_count';
import * as migration_20261013_131706_phase4_payments from './20261013_131706_phase4_payments';
import * as migration_20261013_140807_phase5_fulfilment from './20261013_140807_phase5_fulfilment';
import * as migration_20261014_051640_phase6_order_management from './20261014_051640_phase6_order_management';
import * as migration_20261014_054706_phase7_credentials_audit from './20261014_054706_phase7_credentials_audit';
import * as migration_20261014_123812_phase8_series from './20261014_123812_phase8_series';

export const migrations = [
  {
    up: migration_20261012_065234_initial.up,
    down: migration_20261012_065234_initial.down,
    name: '20261012_065234_initial',
  },
  {
    up: migration_20261013_094049_phase2_storefront.up,
    down: migration_20261013_094049_phase2_storefront.down,
    name: '20261013_094049_phase2_storefront',
  },
  {
    up: migration_20261013_124515_phase3_page_count.up,
    down: migration_20261013_124515_phase3_page_count.down,
    name: '20261013_124515_phase3_page_count',
  },
  {
    up: migration_20261013_131706_phase4_payments.up,
    down: migration_20261013_131706_phase4_payments.down,
    name: '20261013_131706_phase4_payments',
  },
  {
    up: migration_20261013_140807_phase5_fulfilment.up,
    down: migration_20261013_140807_phase5_fulfilment.down,
    name: '20261013_140807_phase5_fulfilment',
  },
  {
    up: migration_20261014_051640_phase6_order_management.up,
    down: migration_20261014_051640_phase6_order_management.down,
    name: '20261014_051640_phase6_order_management',
  },
  {
    up: migration_20261014_054706_phase7_credentials_audit.up,
    down: migration_20261014_054706_phase7_credentials_audit.down,
    name: '20261014_054706_phase7_credentials_audit',
  },
  {
    up: migration_20261014_123812_phase8_series.up,
    down: migration_20261014_123812_phase8_series.down,
    name: '20261014_123812_phase8_series'
  },
];
