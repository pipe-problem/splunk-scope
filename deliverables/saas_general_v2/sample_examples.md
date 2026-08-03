### Salesforce — Admin / configuration audit events
```json
{"timestamp":"2026-06-24T17:17:20.758070Z","tenant_id":"tenant-001","org_id":"org-001","request_id":"req-sal-00000001","source_ip":"203.0.113.42","user_agent":"Mozilla/5.0 (compatible; ExampleBot/1.0; +https://example.com/bot)","vendor":"Salesforce","activity_profile":"normal","event_type":"ADMIN_AUDIT","admin_user":"admin1@example.net","action":"CREATE","object_type":"PermissionSet","object_id":"cfg-000001","old_value":"enabled=false","new_value":"enabled=true","session_id":"sess-admin-1","EVENT_TYPE":"SetupAuditTrail","SECTION":"Setup","DISPLAY":"Changed profile assignment","ORGANIZATION_ID":"org-001"}
```

### Salesforce — Authentication / access security events
```json
{"timestamp":"2026-06-24T17:17:20.758100Z","tenant_id":"tenant-001","org_id":"org-001","request_id":"req-sal-00000001","source_ip":"192.0.2.55","user_agent":"Mozilla/5.0 (compatible; ExampleBot/1.0; +https://example.com/bot)","vendor":"Salesforce","activity_profile":"normal","event_type":"AUTH","user":"user1@example.com","login_result":"FAILURE","mfa_used":false,"sso_provider":"okta","session_id":"sess-00000001","geo_country":"DE","geo_city":"Example City","risk_level":"HIGH","device_id":"device-1","EVENT_TYPE":"Login","LOGIN_STATUS":"FAILURE"}
```

### ServiceNow — Admin / configuration audit events
```json
{"timestamp":"2026-06-24T17:17:20.758116Z","tenant_id":"tenant-001","org_id":"org-001","request_id":"req-ser-00000001","source_ip":"203.0.113.42","user_agent":"Mozilla/5.0 (compatible; ExampleBot/1.0; +https://example.com/bot)","vendor":"ServiceNow","activity_profile":"normal","event_type":"ADMIN_AUDIT","admin_user":"admin1@example.net","action":"DISABLE","object_type":"PermissionSet","object_id":"cfg-000001","old_value":"enabled=false","new_value":"enabled=true","session_id":"sess-admin-1","table":"sys_audit","documentkey":"record-1","fieldname":"state","oldvalue":"1","newvalue":"2"}
```

### ServiceNow — Authentication / access security events
```json
{"timestamp":"2026-06-24T17:17:20.758130Z","tenant_id":"tenant-001","org_id":"org-001","request_id":"req-ser-00000001","source_ip":"198.51.100.88","user_agent":"Mozilla/5.0 (compatible; ExampleBot/1.0; +https://example.com/bot)","vendor":"ServiceNow","activity_profile":"normal","event_type":"AUTH","user":"user1@example.net","login_result":"FAILURE","mfa_used":true,"sso_provider":"native","session_id":"sess-00000001","geo_country":"DE","geo_city":"Sample Town","risk_level":"MEDIUM","device_id":"device-1","event":"login","username":"user1@example.net","status":"FAILURE"}
```
