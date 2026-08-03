/**
 * Maps catalog source IDs to composite sizing panel components.
 * Used by SourceConfigPanel when additive / cloud sizing UX is required.
 */
import IaasSizingPanel from './IaasSizingPanel.jsx';
import OfficeProductivitySizingPanel from './OfficeProductivitySizingPanel.jsx';
import CrmSizingPanel from './CrmSizingPanel.jsx';
import SaaSSizingPanel from './SaaSSizingPanel.jsx';
import SsoIdentitySizingPanel from './SsoIdentitySizingPanel.jsx';
import CloudVmSizingPanel from './CloudVmSizingPanel.jsx';
import CloudStorageSizingPanel from './CloudStorageSizingPanel.jsx';
import ContainerSizingPanel from './ContainerSizingPanel.jsx';

/** @type {Record<string, import('react').ComponentType<{ sourceId: string, ss: object, sessionSources: object, update: Function }>>} */
export const SIZING_PANEL_BY_SOURCE_ID = {
  iaas: IaasSizingPanel,
  iaas_instances: CloudVmSizingPanel,
  iaas_storage: CloudStorageSizingPanel,
  iaas_containers: ContainerSizingPanel,
  saas_general: SaaSSizingPanel,
  saas_office: OfficeProductivitySizingPanel,
  saas_crm: CrmSizingPanel,
  saas_sso: SsoIdentitySizingPanel,
};

/** Strategy values in sources.json that require a composite panel (for test closure). */
export const ADDITIVE_SIZING_STRATEGIES = new Set([
  'iaas_cloud',
  'container_additive',
  'cloud_vm_additive',
  'cloud_storage_additive',
  'office_productivity_additive',
  'crm_additive',
  'sso_identity_additive',
]);

export function getSizingPanelForSource(sourceId) {
  if (!sourceId) return null;
  return SIZING_PANEL_BY_SOURCE_ID[sourceId] || null;
}

export function hasCompositeSizingPanel(sourceId) {
  return Boolean(getSizingPanelForSource(sourceId));
}

export function listCompositeSizingSourceIds() {
  return Object.keys(SIZING_PANEL_BY_SOURCE_ID);
}
