package plugin

// ThrukAPIEndpoint represents all available REST API endpoints of Thruk.
// Generated from Thruk's indexer JSON; type is int for easy comparison.
// the indexer response can be found in docs/r-v1-index-response.json
// Enum values are auto-assigned via iota starting at 0.
type ThrukAPIEndpoint int

const (
	// GET / lists all available rest urls.
	EndpointListRoot ThrukAPIEndpoint = iota
	// GET /alerts lists alerts based on logfiles.
	EndpointListAlerts
	// GET /checks/stats lists host / service check statistics.
	EndpointListCheckStats
	// POST /cmd Sends any command.
	EndpointSendCommand
	// GET /commands lists livestatus commands.
	EndpointListCommands
	// GET /commands/<name> lists commands for given name.
	EndpointListCommandByName
	// GET /commands/<name>/config Returns configuration for given command.
	EndpointGetCommandConfig
	// POST /commands/<name>/config Replace command configuration completely, use PATCH to only update specific attributes.
	EndpointReplaceCommandConfig
	// PATCH /commands/<name>/config Update command configuration partially.
	EndpointPatchCommandConfig
	// DELETE /commands/<name>/config Deletes given command from configuration.
	EndpointDeleteCommandConfig
	// GET /comments lists livestatus comments.
	EndpointListComments
	// GET /comments/<id> lists comments for given id.
	EndpointListCommentByID
	// POST /config/check Returns result from config check. This check does require changes to be saved to disk before running the check.
	EndpointRunConfigCheck
	// GET /config/diff
	EndpointGetConfigDiff
	// POST /config/discard Reverts stashed configuration changes.
	EndpointDiscardConfigChanges
	// GET /config/files returns all config files
	EndpointListConfigFiles
	// GET /config/fullobjects Returns list of all objects with templates expanded.
	EndpointListFullObjects
	// GET /config/objects Returns list of all objects with their raw config.
	EndpointListObjects
	// POST /config/objects Create new object. Besides the actual object config, requires
	EndpointCreateObject
	// PATCH /config/objects Change attributes for all matching objects.
	EndpointPatchObjects
	// DELETE /config/objects Delete objects based on filters.
	EndpointDeleteObjects
	// POST /config/objects/<id> Replace object configuration completely.
	EndpointReplaceObjectByID
	// PATCH /config/objects/<id> Update object configuration partially.
	EndpointPatchObjectByID
	// DELETE /config/objects/<id> Remove given object from configuration.
	EndpointDeleteObjectByID
	// GET /config/precheck Returns result from Thruks config precheck. The precheck does not require changes to be saved to disk before running the check.
	EndpointRunConfigPrecheck
	// POST /config/reload Reloads configuration with the configured reload command.
	EndpointReloadConfig
	// POST /config/revert Reverts stashed configuration changes.
	EndpointRevertConfigChanges
	// POST /config/save Saves stashed configuration changes to disk.
	EndpointSaveConfigChanges
	// GET /contactgroups lists livestatus contactgroups.
	EndpointListContactGroups
	// GET /contactgroups/<name> lists contactgroups for given name.
	EndpointListContactGroupByName
	// POST /contactgroups/<name>/cmd/disable_contactgroup_host_notifications Disables host notifications for all contacts in a particular contactgroup.
	EndpointDisableContactGroupHostNotifications
	// POST /contactgroups/<name>/cmd/disable_contactgroup_svc_notifications Disables service notifications for all contacts in a particular contactgroup.
	EndpointDisableContactGroupSVCNotifications
	// POST /contactgroups/<name>/cmd/enable_contactgroup_host_notifications Enables host notifications for all contacts in a particular contactgroup.
	EndpointEnableContactGroupHostNotifications
	// POST /contactgroups/<name>/cmd/enable_contactgroup_svc_notifications Enables service notifications for all contacts in a particular contactgroup.
	EndpointEnableContactGroupSVCNotifications
	// GET /contactgroups/<name>/config Returns configuration for given contactgroup.
	EndpointGetContactGroupConfig
	// POST /contactgroups/<name>/config Replace contactgroup configuration completely, use PATCH to only update specific attributes.
	EndpointReplaceContactGroupConfig
	// PATCH /contactgroups/<name>/config Update contactgroup configuration partially.
	EndpointPatchContactGroupConfig
	// DELETE /contactgroups/<name>/config Deletes given contactgroup from configuration.
	EndpointDeleteContactGroupConfig
	// GET /contacts lists livestatus contacts.
	EndpointListContacts
	// GET /contacts/<name> lists contacts for given name.
	EndpointListContactByName
	// POST /contacts/<name>/cmd/change_contact_host_notification_timeperiod Changes the host notification timeperiod for a particular contact to what is specified by the 'notification_timeperiod' option. The 'notification_timeperiod' option should be the short name of the timeperiod that is to be used as the contact's host notification timeperiod. The timeperiod must have been configured in Naemon before it was last (re)started.
	EndpointChangeContactHostNotificationTimeperiod
	// POST /contacts/<name>/cmd/change_contact_svc_notification_timeperiod Changes the service notification timeperiod for a particular contact to what is specified by the 'notification_timeperiod' option. The 'notification_timeperiod' option should be the short name of the timeperiod that is to be used as the contact's service notification timeperiod. The timeperiod must have been configured in Naemon before it was last (re)started.
	EndpointChangeContactSVCNotificationTimeperiod
	// POST /contacts/<name>/cmd/change_custom_contact_var Changes the value of a custom contact variable.
	EndpointChangeCustomContactVar
	// POST /contacts/<name>/cmd/disable_contact_host_notifications Disables host notifications for a particular contact.
	EndpointDisableContactHostNotifications
	// POST /contacts/<name>/cmd/disable_contact_svc_notifications Disables service notifications for a particular contact.
	EndpointDisableContactSVCNotifications
	// POST /contacts/<name>/cmd/enable_contact_host_notifications Enables host notifications for a particular contact.
	EndpointEnableContactHostNotifications
	// POST /contacts/<name>/cmd/enable_contact_svc_notifications Disables service notifications for a particular contact.
	EndpointEnableContactSVCNotifications
	// GET /contacts/<name>/config Returns configuration for given contact.
	EndpointGetContactConfig
	// POST /contacts/<name>/config Replace contact configuration completely, use PATCH to only update specific attributes.
	EndpointReplaceContactConfig
	// PATCH /contacts/<name>/config Update contact configuration partially.
	EndpointPatchContactConfig
	// DELETE /contacts/<name>/config Deletes given contact from configuration.
	EndpointDeleteContactConfig
	// GET /contacts/totals hash of livestatus contacts totals statistics.
	EndpointGetContactTotals
	// GET /downtimes lists livestatus downtimes.
	EndpointListDowntimes
	// GET /downtimes/<id> lists downtimes for given id.
	EndpointListDowntimeByID
	// GET /hostgroups lists livestatus hostgroups.
	EndpointListHostGroups
	// GET /hostgroups/<name> lists hostgroups for given name.
	EndpointListHostGroupByName
	// GET /hostgroups/<name>/availability list availability for this hostgroup.
	EndpointGetHostGroupAvailability
	// POST /hostgroups/<name>/cmd/disable_hostgroup_host_checks Sends the DISABLE_HOSTGROUP_HOST_CHECKS command.
	EndpointDisableHostGroupHostChecks
	// POST /hostgroups/<name>/cmd/disable_hostgroup_host_notifications Sends the DISABLE_HOSTGROUP_HOST_NOTIFICATIONS command.
	EndpointDisableHostGroupHostNotifications
	// POST /hostgroups/<name>/cmd/disable_hostgroup_passive_host_checks Disables passive checks for all hosts in a particular hostgroup.
	EndpointDisableHostGroupPassiveHostChecks
	// POST /hostgroups/<name>/cmd/disable_hostgroup_passive_svc_checks Disables passive checks for all services associated with hosts in a particular hostgroup.
	EndpointDisableHostGroupPassiveSVCChecks
	// POST /hostgroups/<name>/cmd/disable_hostgroup_svc_checks Sends the DISABLE_HOSTGROUP_SVC_CHECKS command.
	EndpointDisableHostGroupSVCChecks
	// POST /hostgroups/<name>/cmd/disable_hostgroup_svc_notifications Sends the DISABLE_HOSTGROUP_SVC_NOTIFICATIONS command.
	EndpointDisableHostGroupSVCNotifications
	// POST /hostgroups/<name>/cmd/enable_hostgroup_host_checks Sends the ENABLE_HOSTGROUP_HOST_CHECKS command.
	EndpointEnableHostGroupHostChecks
	// POST /hostgroups/<name>/cmd/enable_hostgroup_host_notifications Sends the ENABLE_HOSTGROUP_HOST_NOTIFICATIONS command.
	EndpointEnableHostGroupHostNotifications
	// POST /hostgroups/<name>/cmd/enable_hostgroup_passive_host_checks Enables passive checks for all hosts in a particular hostgroup.
	EndpointEnableHostGroupPassiveHostChecks
	// POST /hostgroups/<name>/cmd/enable_hostgroup_passive_svc_checks Enables passive checks for all services associated with hosts in a particular hostgroup.
	EndpointEnableHostGroupPassiveSVCChecks
	// POST /hostgroups/<name>/cmd/enable_hostgroup_svc_checks Sends the ENABLE_HOSTGROUP_SVC_CHECKS command.
	EndpointEnableHostGroupSVCChecks
	// POST /hostgroups/<name>/cmd/enable_hostgroup_svc_notifications Sends the ENABLE_HOSTGROUP_SVC_NOTIFICATIONS command.
	EndpointEnableHostGroupSVCNotifications
	// POST /hostgroups/<name>/cmd/schedule_hostgroup_host_downtime Sends the SCHEDULE_HOSTGROUP_HOST_DOWNTIME command.
	EndpointScheduleHostGroupHostDowntime
	// POST /hostgroups/<name>/cmd/schedule_hostgroup_svc_downtime Sends the SCHEDULE_HOSTGROUP_SVC_DOWNTIME command.
	EndpointScheduleHostGroupSVCdowntime
	// GET /hostgroups/<name>/config Returns configuration for given hostgroup.
	EndpointGetHostGroupConfig
	// POST /hostgroups/<name>/config Replace hostgroups configuration completely, use PATCH to only update specific attributes.
	EndpointReplaceHostGroupConfig
	// PATCH /hostgroups/<name>/config Update hostgroup configuration partially.
	EndpointPatchHostGroupConfig
	// DELETE /hostgroups/<name>/config Deletes given hostgroup from configuration.
	EndpointDeleteHostGroupConfig
	// GET /hostgroups/<name>/outages list of outages for this hostgroup.
	EndpointGetHostGroupOutages
	// GET /hostgroups/<name>/stats hash of livestatus hostgroup statistics.
	EndpointGetHostGroupStats
	// GET /hosts lists livestatus hosts.
	EndpointListHosts
	// GET /hosts/<name> lists hosts for given name.
	EndpointListHostByName
	// GET /hosts/<name>/alerts lists alerts for given host.
	EndpointListHostAlerts
	// GET /hosts/<name>/availability list availability for this host.
	EndpointGetHostAvailability
	// POST /hosts/<name>/cmd/acknowledge_host_problem Sends the ACKNOWLEDGE_HOST_PROBLEM command.
	EndpointAcknowledgeHostProblem
	// POST /hosts/<name>/cmd/acknowledge_host_problem_expire Sends the ACKNOWLEDGE_HOST_PROBLEM_EXPIRE command.
	EndpointAcknowledgeHostProblemExpire
	// POST /hosts/<name>/cmd/add_host_comment Sends the ADD_HOST_COMMENT command.
	EndpointAddHostComment
	// POST /hosts/<name>/cmd/change_custom_host_var Changes the value of a custom host variable.
	EndpointChangeCustomHostVar
	// POST /hosts/<name>/cmd/change_host_check_timeperiod Changes the valid check period for the specified host.
	EndpointChangeHostCheckTimeperiod
	// POST /hosts/<name>/cmd/change_host_modattr Sends the CHANGE_HOST_MODATTR command.
	EndpointChangeHostModattr
	// POST /hosts/<name>/cmd/change_host_notification_timeperiod Changes the host notification timeperiod to what is specified by the 'notification_timeperiod' option. The 'notification_timeperiod' option should be the short name of the timeperiod that is to be used as the service notification timeperiod. The timeperiod must have been configured in Naemon before it was last (re)started.
	EndpointChangeHostNotificationTimeperiod
	// POST /hosts/<name>/cmd/change_max_host_check_attempts Changes the maximum number of check attempts (retries) for a particular host.
	EndpointChangeMaxHostCheckAttempts
	// POST /hosts/<name>/cmd/change_normal_host_check_interval Changes the normal (regularly scheduled) check interval for a particular host.
	EndpointChangeNormalHostCheckInterval
	// POST /hosts/<name>/cmd/change_retry_host_check_interval Changes the retry check interval for a particular host.
	EndpointChangeRetryHostCheckInterval
	// POST /hosts/<name>/cmd/del_active_host_downtimes Removes all currently active downtimes for this host.
	EndpointDeleteActiveHostDowntimes
	// POST /hosts/<name>/cmd/del_all_host_comments Sends the DEL_ALL_HOST_COMMENTS command.
	EndpointDeleteAllHostComments
	// POST /hosts/<name>/cmd/del_comment Removes downtime by id for this host.
	EndpointDeleteComment
	// POST /hosts/<name>/cmd/del_downtime Removes downtime by id for this host.
	EndpointDeleteDowntime
	// POST /hosts/<name>/cmd/delay_host_notification Sends the DELAY_HOST_NOTIFICATION command.
	EndpointDelayHostNotification
	// POST /hosts/<name>/cmd/disable_all_notifications_beyond_host Sends the DISABLE_ALL_NOTIFICATIONS_BEYOND_HOST command.
	EndpointDisableAllNotificationsBeyondHost
	// POST /hosts/<name>/cmd/disable_host_and_child_notifications Sends the DISABLE_HOST_AND_CHILD_NOTIFICATIONS command.
	EndpointDisableHostAndChildNotifications
	// POST /hosts/<name>/cmd/disable_host_check Sends the DISABLE_HOST_CHECK command.
	EndpointDisableHostCheck
	// POST /hosts/<name>/cmd/disable_host_event_handler Sends the DISABLE_HOST_EVENT_HANDLER command.
	EndpointDisableHostEventHandler
	// POST /hosts/<name>/cmd/disable_host_flap_detection Sends the DISABLE_HOST_FLAP_DETECTION command.
	EndpointDisableHostFlapDetection
	// POST /hosts/<name>/cmd/disable_host_notifications Sends the DISABLE_HOST_NOTIFICATIONS command.
	EndpointDisableHostNotifications
	// POST /hosts/<name>/cmd/disable_host_svc_checks Sends the DISABLE_HOST_SVC_CHECKS command.
	EndpointDisableHostSVCChecks
	// POST /hosts/<name>/cmd/disable_host_svc_notifications Sends the DISABLE_HOST_SVC_NOTIFICATIONS command.
	EndpointDisableHostSVCNotifications
	// POST /hosts/<name>/cmd/disable_passive_host_checks Sends the DISABLE_PASSIVE_HOST_CHECKS command.
	EndpointDisablePassiveHostChecks
	// POST /hosts/<name>/cmd/enable_all_notifications_beyond_host Sends the ENABLE_ALL_NOTIFICATIONS_BEYOND_HOST command.
	EndpointEnableAllNotificationsBeyondHost
	// POST /hosts/<name>/cmd/enable_host_and_child_notifications Sends the ENABLE_HOST_AND_CHILD_NOTIFICATIONS command.
	EndpointEnableHostAndChildNotifications
	// POST /hosts/<name>/cmd/enable_host_check Sends the ENABLE_HOST_CHECK command.
	EndpointEnableHostCheck
	// POST /hosts/<name>/cmd/enable_host_event_handler Sends the ENABLE_HOST_EVENT_HANDLER command.
	EndpointEnableHostEventHandler
	// POST /hosts/<name>/cmd/enable_host_flap_detection Sends the ENABLE_HOST_FLAP_DETECTION command.
	EndpointEnableHostFlapDetection
	// POST /hosts/<name>/cmd/enable_host_notifications Sends the ENABLE_HOST_NOTIFICATIONS command.
	EndpointEnableHostNotifications
	// POST /hosts/<name>/cmd/enable_host_svc_checks Sends the ENABLE_HOST_SVC_CHECKS command.
	EndpointEnableHostSVCChecks
	// POST /hosts/<name>/cmd/enable_host_svc_notifications Sends the ENABLE_HOST_SVC_NOTIFICATIONS command.
	EndpointEnableHostSVCNotifications
	// POST /hosts/<name>/cmd/enable_passive_host_checks Sends the ENABLE_PASSIVE_HOST_CHECKS command.
	EndpointEnablePassiveHostChecks
	// POST /hosts/<name>/cmd/note Add host note to core log.
	EndpointAddHostNote
	// POST /hosts/<name>/cmd/process_host_check_result Sends the PROCESS_HOST_CHECK_RESULT command.
	EndpointProcessHostCheckResult
	// POST /hosts/<name>/cmd/remove_host_acknowledgement Sends the REMOVE_HOST_ACKNOWLEDGEMENT command.
	EndpointRemoveHostAcknowledgement
	// POST /hosts/<name>/cmd/schedule_and_propagate_host_downtime Sends the SCHEDULE_AND_PROPAGATE_HOST_DOWNTIME command.
	EndpointScheduleAndPropagateHostDowntime
	// POST /hosts/<name>/cmd/schedule_and_propagate_triggered_host_downtime Sends the SCHEDULE_AND_PROPAGATE_TRIGGERED_HOST_DOWNTIME command.
	EndpointScheduleAndPropagateTriggeredHostDowntime
	// POST /hosts/<name>/cmd/schedule_forced_host_check Sends the SCHEDULE_FORCED_HOST_CHECK command.
	EndpointScheduleForcedHostCheck
	// POST /hosts/<name>/cmd/schedule_forced_host_svc_checks Sends the SCHEDULE_FORCED_HOST_SVC_CHECKS command.
	EndpointScheduleForcedHostSVCChecks
	// POST /hosts/<name>/cmd/schedule_host_check Sends the SCHEDULE_HOST_CHECK command.
	EndpointScheduleHostCheck
	// POST /hosts/<name>/cmd/schedule_host_downtime Sends the SCHEDULE_HOST_DOWNTIME command.
	EndpointScheduleHostDowntime
	// POST /hosts/<name>/cmd/schedule_host_svc_checks Sends the SCHEDULE_HOST_SVC_CHECKS command.
	EndpointScheduleHostSVCChecks
	// POST /hosts/<name>/cmd/schedule_host_svc_downtime Sends the SCHEDULE_HOST_SVC_DOWNTIME command.
	EndpointScheduleHostSVCdowntime
	// POST /hosts/<name>/cmd/send_custom_host_notification Sends the SEND_CUSTOM_HOST_NOTIFICATION command.
	EndpointSendCustomHostNotification
	// POST /hosts/<name>/cmd/set_host_notification_number Sets the current notification number for a particular host. A value of 0 indicates that no notification has yet been sent for the current host problem. Useful for forcing an escalation (based on notification number) or replicating notification information in redundant monitoring environments. Notification numbers greater than zero have no noticeable affect on the notification process if the host is currently in an UP state.
	EndpointSetHostNotificationNumber
	// POST /hosts/<name>/cmd/start_obsessing_over_host Sends the START_OBSESSING_OVER_HOST command.
	EndpointStartObsessingOverHost
	// POST /hosts/<name>/cmd/stop_obsessing_over_host Sends the STOP_OBSESSING_OVER_HOST command.
	EndpointStopObsessingOverHost
	// GET /hosts/<name>/commandline displays commandline for check command of given hosts.
	EndpointGetHostCommandline
	// GET /hosts/<name>/config Returns configuration for given host.
	EndpointGetHostConfig
	// POST /hosts/<name>/config Replace host configuration completely, use PATCH to only update specific attributes.
	EndpointReplaceHostConfig
	// PATCH /hosts/<name>/config Update host configuration partially.
	EndpointPatchHostConfig
	// DELETE /hosts/<name>/config Deletes given host from configuration.
	EndpointDeleteHostConfig
	// GET /hosts/<name>/notifications lists notifications for given host.
	EndpointListHostNotifications
	// GET /hosts/<name>/outages list of outages for this host.
	EndpointGetHostOutages
	// GET /hosts/<name>/services lists services for given host.
	EndpointListHostServices
	// GET /hosts/availability list availability for all hosts.
	EndpointGetHostsAvailability
	// GET /hosts/outages list of outages for all hosts.
	EndpointGetHostsOutages
	// GET /hosts/stats hash of livestatus host statistics.
	EndpointGetHostStats
	// GET /hosts/totals hash of livestatus host totals statistics.
	EndpointGetHostTotals
	// GET /index lists all available rest urls.
	EndpointListIndex
	// GET /lmd/sites lists connected sites. Only available if LMD (`use_lmd`) is enabled.
	EndpointListLMDSites
	// GET /logs lists livestatus logs.
	EndpointListLogs
	// GET /notifications lists notifications based on logfiles.
	EndpointListNotifications
	// GET /processinfo lists livestatus sites status.
	EndpointListProcessInfo
	// GET /processinfo/stats lists livestatus sites statistics.
	EndpointListProcessInfoStats
	// GET /servicegroups lists livestatus servicegroups.
	EndpointListServiceGroups
	// GET /servicegroups/<name> lists servicegroups for given name.
	EndpointListServiceGroupByName
	// GET /servicegroups/<name>/availability list availability for this servicegroup.
	EndpointGetServiceGroupAvailability
	// POST /servicegroups/<name>/cmd/disable_servicegroup_host_checks Sends the DISABLE_SERVICEGROUP_HOST_CHECKS command.
	EndpointDisableServiceGroupHostChecks
	// POST /servicegroups/<name>/cmd/disable_servicegroup_host_notifications Sends the DISABLE_SERVICEGROUP_HOST_NOTIFICATIONS command.
	EndpointDisableServiceGroupHostNotifications
	// POST /servicegroups/<name>/cmd/disable_servicegroup_passive_host_checks Disables the acceptance and processing of passive checks for all hosts that have services that are members of a particular service group.
	EndpointDisableServiceGroupPassiveHostChecks
	// POST /servicegroups/<name>/cmd/disable_servicegroup_passive_svc_checks Disables the acceptance and processing of passive checks for all services in a particular servicegroup.
	EndpointDisableServiceGroupPassiveSVCChecks
	// POST /servicegroups/<name>/cmd/disable_servicegroup_svc_checks Sends the DISABLE_SERVICEGROUP_SVC_CHECKS command.
	EndpointDisableServiceGroupSVCChecks
	// POST /servicegroups/<name>/cmd/disable_servicegroup_svc_notifications Sends the DISABLE_SERVICEGROUP_SVC_NOTIFICATIONS command.
	EndpointDisableServiceGroupSVCNotifications
	// POST /servicegroups/<name>/cmd/enable_servicegroup_host_checks Sends the ENABLE_SERVICEGROUP_HOST_CHECKS command.
	EndpointEnableServiceGroupHostChecks
	// POST /servicegroups/<name>/cmd/enable_servicegroup_host_notifications Sends the ENABLE_SERVICEGROUP_HOST_NOTIFICATIONS command.
	EndpointEnableServiceGroupHostNotifications
	// POST /servicegroups/<name>/cmd/enable_servicegroup_passive_host_checks Enables the acceptance and processing of passive checks for all hosts that have services that are members of a particular service group.
	EndpointEnableServiceGroupPassiveHostChecks
	// POST /servicegroups/<name>/cmd/enable_servicegroup_passive_svc_checks Enables the acceptance and processing of passive checks for all services in a particular servicegroup.
	EndpointEnableServiceGroupPassiveSVCChecks
	// POST /servicegroups/<name>/cmd/enable_servicegroup_svc_checks Sends the ENABLE_SERVICEGROUP_SVC_CHECKS command.
	EndpointEnableServiceGroupSVCChecks
	// POST /servicegroups/<name>/cmd/enable_servicegroup_svc_notifications Sends the ENABLE_SERVICEGROUP_SVC_NOTIFICATIONS command.
	EndpointEnableServiceGroupSVCNotifications
	// POST /servicegroups/<name>/cmd/schedule_servicegroup_host_downtime Sends the SCHEDULE_SERVICEGROUP_HOST_DOWNTIME command.
	EndpointScheduleServiceGroupHostDowntime
	// POST /servicegroups/<name>/cmd/schedule_servicegroup_svc_downtime Sends the SCHEDULE_SERVICEGROUP_SVC_DOWNTIME command.
	EndpointScheduleServiceGroupSVCdowntime
	// GET /servicegroups/<name>/config Returns configuration for given servicegroup.
	EndpointGetServiceGroupConfig
	// POST /servicegroups/<name>/config Replace servicegroup configuration completely, use PATCH to only update specific attributes.
	EndpointReplaceServiceGroupConfig
	// PATCH /servicegroups/<name>/config Update servicegroup configuration partially.
	EndpointPatchServiceGroupConfig
	// DELETE /servicegroups/<name>/config Deletes given servicegroup from configuration.
	EndpointDeleteServiceGroupConfig
	// GET /servicegroups/<name>/outages list of outages for this servicegroup.
	EndpointGetServiceGroupOutages
	// GET /servicegroups/<name>/stats hash of livestatus servicegroup statistics.
	EndpointGetServiceGroupStats
	// GET /services lists livestatus services.
	EndpointListServices
	// GET /services/<host>/<service> lists services for given host and name.
	EndpointListServiceByHostAndName
	// GET /services/<host>/<service>/availability list of outages for this service.
	// Note: description says "availability", but URL path indicates "outages" based on context. Kept as-is per spec.
	EndpointGetServiceAvailability
	// POST /services/<host>/<service>/cmd/acknowledge_svc_problem Sends the ACKNOWLEDGE_SVC_PROBLEM command.
	EndpointAcknowledgeSVCProblem
	// POST /services/<host>/<service>/cmd/acknowledge_svc_problem_expire Sends the ACKNOWLEDGE_SVC_PROBLEM_EXPIRE command.
	EndpointAcknowledgeSVCProblemExpire
	// POST /services/<host>/<service>/cmd/add_svc_comment Sends the ADD_SVC_COMMENT command.
	EndpointAddSVCComment
	// POST /services/<host>/<service>/cmd/change_custom_svc_var Changes the value of a custom service variable.
	EndpointChangeCustomSVCVar
	// POST /services/<host>/<service>/cmd/change_max_svc_check_attempts Changes the maximum number of check attempts (retries) for a particular service.
	EndpointChangeMaxSVCCheckAttempts
	// POST /services/<host>/<service>/cmd/change_normal_svc_check_interval Changes the normal (regularly scheduled) check interval for a particular service
	EndpointChangeNormalSVCCheckInterval
	// POST /services/<host>/<service>/cmd/change_retry_svc_check_interval Changes the retry check interval for a particular service.
	EndpointChangeRetrySVCCheckInterval
	// POST /services/<host>/<service>/cmd/change_svc_check_timeperiod Changes the check timeperiod for a particular service to what is specified by the 'check_timeperiod' option. The 'check_timeperiod' option should be the short name of the timeperod that is to be used as the service check timeperiod. The timeperiod must have been configured in Naemon before it was last (re)started.
	EndpointChangeSVCCheckTimeperiod
	// POST /services/<host>/<service>/cmd/change_svc_modattr Sends the CHANGE_SVC_MODATTR command.
	EndpointChangeSVCModattr
	// POST /services/<host>/<service>/cmd/change_svc_notification_timeperiod Changes the service notification timeperiod to what is specified by the 'notification_timeperiod' option. The 'notification_timeperiod' option should be the short name of the timeperiod that is to be used as the service notification timeperiod. The timeperiod must have been configured in Naemon before it was last (re)started.
	EndpointChangeSVCNotificationTimeperiod
	// POST /services/<host>/<service>/cmd/del_active_service_downtimes Removes all currently active downtimes for this service.
	EndpointDeleteActiveServiceDowntimes
	// POST /services/<host>/<service>/cmd/del_all_svc_comments Sends the DEL_ALL_SVC_COMMENTS command.
	EndpointDeleteAllSVCComments
	// POST /services/<host>/<service>/cmd/del_comment Removes downtime by id for this service.
	EndpointDeleteSVCComment
	// POST /services/<host>/<service>/cmd/del_downtime Removes downtime by id for this service.
	EndpointDeleteSVCDowntime
	// POST /services/<host>/<service>/cmd/delay_svc_notification Sends the DELAY_SVC_NOTIFICATION command.
	EndpointDelaySVCNotification
	// POST /services/<host>/<service>/cmd/disable_passive_svc_checks Sends the DISABLE_PASSIVE_SVC_CHECKS command.
	EndpointDisablePassiveSVCChecks
	// POST /services/<host>/<service>/cmd/disable_svc_check Sends the DISABLE_SVC_CHECK command.
	EndpointDisableSVCCheck
	// POST /services/<host>/<service>/cmd/disable_svc_event_handler Sends the DISABLE_SVC_EVENT_HANDLER command.
	EndpointDisableSVCEventHandler
	// POST /services/<host>/<service>/cmd/disable_svc_flap_detection Sends the DISABLE_SVC_FLAP_DETECTION command.
	EndpointDisableSVCFlapDetection
	// POST /services/<host>/<service>/cmd/disable_svc_notifications Sends the DISABLE_SVC_NOTIFICATIONS command.
	EndpointDisableSVCNotifications
	// POST /services/<host>/<service>/cmd/enable_passive_svc_checks Sends the ENABLE_PASSIVE_SVC_CHECKS command.
	EndpointEnablePassiveSVCChecks
	// POST /services/<host>/<service>/cmd/enable_svc_check Sends the ENABLE_SVC_CHECK command.
	EndpointEnableSVCCheck
	// POST /services/<host>/<service>/cmd/enable_svc_event_handler Sends the ENABLE_SVC_EVENT_HANDLER command.
	EndpointEnableSVCEventHandler
	// POST /services/<host>/<service>/cmd/enable_svc_flap_detection Sends the ENABLE_SVC_FLAP_DETECTION command.
	EndpointEnableSVCFlapDetection
	// POST /services/<host>/<service>/cmd/enable_svc_notifications Sends the ENABLE_SVC_NOTIFICATIONS command.
	EndpointEnableSVCNotifications
	// POST /services/<host>/<service>/cmd/note Add service note to core log.
	EndpointAddSVCNote
	// POST /services/<host>/<service>/cmd/process_service_check_result Sends the PROCESS_SERVICE_CHECK_RESULT command.
	EndpointProcessServiceCheckResult
	// POST /services/<host>/<service>/cmd/remove_svc_acknowledgement Sends the REMOVE_SVC_ACKNOWLEDGEMENT command.
	EndpointRemoveSVCAcknowledgement
	// POST /services/<host>/<service>/cmd/schedule_forced_svc_check Sends the SCHEDULE_FORCED_SVC_CHECK command.
	EndpointScheduleForcedSVCCheck
	// POST /services/<host>/<service>/cmd/schedule_svc_check Sends the SCHEDULE_SVC_CHECK command.
	EndpointScheduleSVCCheck
	// POST /services/<host>/<service>/cmd/schedule_svc_downtime Sends the SCHEDULE_SVC_DOWNTIME command.
	EndpointScheduleSVCDowntime
	// POST /services/<host>/<service>/cmd/send_custom_svc_notification Sends the SEND_CUSTOM_SVC_NOTIFICATION command.
	EndpointSendCustomSVCNotification
	// POST /services/<host>/<service>/cmd/set_svc_notification_number Sets the current notification number for a particular service. A value of 0 indicates that no notification has yet been sent for the current service problem. Useful for forcing an escalation (based on notification number) or replicating notification information in redundant monitoring environments. Notification numbers greater than zero have no noticeable affect on the notification process if the service is currently in an OK state.
	EndpointSetSVCNotificationNumber
	// POST /services/<host>/<service>/cmd/start_obsessing_over_svc Sends the START_OBSESSING_OVER_SVC command.
	EndpointStartObsessingOverSVC
	// POST /services/<host>/<service>/cmd/stop_obsessing_over_svc Sends the STOP_OBSESSING_OVER_SVC command.
	EndpointStopObsessingOverSVC
	// GET /services/<host>/<service>/commandline displays commandline for check command of given services.
	EndpointGetServiceCommandline
	// GET /services/<host>/<service>/config Returns configuration for given service.
	EndpointGetServiceConfig
	// POST /services/<host>/<service>/config Replace service configuration completely, use PATCH to only update specific attributes.
	EndpointReplaceServiceConfig
	// PATCH /services/<host>/<service>/config Update service configuration partially.
	EndpointPatchServiceConfig
	// DELETE /services/<host>/<service>/config Deletes given service from configuration.
	EndpointDeleteServiceConfig
	// GET /services/<host>/<service>/outages list of outages for this service.
	EndpointGetServiceOutages
	// GET /services/availability list availability for all services.
	EndpointGetServicesAvailability
	// GET /services/outages list of outages for all services.
	EndpointGetServicesOutages
	// GET /services/stats livestatus service statistics.
	EndpointGetServiceStats
	// GET /services/totals livestatus service totals statistics.
	EndpointGetServiceTotals
	// GET /sites lists configured backends
	EndpointListSites
	// POST /system/cmd/change_global_host_event_handler Changes the global host event handler command to be that specified by the 'event_handler_command' option. The 'event_handler_command' option specifies the short name of the command that should be used as the new host event handler. The command must have been configured in Naemon before it was last (re)started.
	EndpointChangeGlobalHostEventHandler
	// POST /system/cmd/change_global_svc_event_handler Changes the global service event handler command to be that specified by the 'event_handler_command' option. The 'event_handler_command' option specifies the short name of the command that should be used as the new service event handler. The command must have been configured in Naemon before it was last (re)started.
	EndpointChangeGlobalSVCEventHandler
	// POST /system/cmd/del_downtime_by_host_name This command deletes all downtimes matching the specified filters.
	EndpointDeleteDowntimeByHostName
	// POST /system/cmd/del_downtime_by_hostgroup_name This command deletes all downtimes matching the specified filters.
	EndpointDeleteDowntimeByHostgroupName
	// POST /system/cmd/del_downtime_by_start_time_comment This command deletes all downtimes matching the specified filters.
	EndpointDeleteDowntimeByStartTimeComment
	// POST /system/cmd/del_host_comment Sends the DEL_HOST_COMMENT command.
	EndpointDelHostComment
	// POST /system/cmd/del_host_downtime Sends the DEL_HOST_DOWNTIME command.
	EndpointDelHostDowntime
	// POST /system/cmd/del_svc_comment Sends the DEL_SVC_COMMENT command.
	EndpointDelSVCComment
	// POST /system/cmd/del_svc_downtime Sends the DEL_SVC_DOWNTIME command.
	EndpointDelSVCDowntime
	// POST /system/cmd/disable_event_handlers Sends the DISABLE_EVENT_HANDLERS command.
	EndpointDisableEventHandlers
	// POST /system/cmd/disable_flap_detection Sends the DISABLE_FLAP_DETECTION command.
	EndpointDisableFlapDetection
	// POST /system/cmd/disable_host_freshness_checks Disables freshness checks of all hosts on a program-wide basis.
	EndpointDisableHostFreshnessChecks
	// POST /system/cmd/disable_notifications Sends the DISABLE_NOTIFICATIONS command.
	EndpointDisableNotifications
	// POST /system/cmd/disable_performance_data Sends the DISABLE_PERFORMANCE_DATA command.
	EndpointDisablePerformanceData
	// POST /system/cmd/disable_service_freshness_checks Disables freshness checks of all services on a program-wide basis.
	EndpointDisableServiceFreshnessChecks
	// POST /system/cmd/enable_event_handlers Sends the ENABLE_EVENT_HANDLERS command.
	EndpointEnableEventHandlers
	// POST /system/cmd/enable_flap_detection Sends the ENABLE_FLAP_DETECTION command.
	EndpointEnableFlapDetection
	// POST /system/cmd/enable_host_freshness_checks Enables freshness checks of all services on a program-wide basis. Individual services that have freshness checks disabled will not be checked for freshness.
	EndpointEnableHostFreshnessChecks
	// POST /system/cmd/enable_notifications Sends the ENABLE_NOTIFICATIONS command.
	EndpointEnableNotifications
	// POST /system/cmd/enable_performance_data Sends the ENABLE_PERFORMANCE_DATA command.
	EndpointEnablePerformanceData
	// POST /system/cmd/enable_service_freshness_checks Enables freshness checks of all services on a program-wide basis. Individual services that have freshness checks disabled will not be checked for freshness.
	EndpointEnableServiceFreshnessChecks
	// POST /system/cmd/log Add custom log entry to core log.
	EndpointAddCustomLogEntry
	// POST /system/cmd/read_state_information Causes Naemon to load all current monitoring status information from the state retention file. Normally, state retention information is loaded when the Naemon process starts up and before it starts monitoring. WARNING: This command will cause Naemon to discard all current monitoring status information and use the information stored in state retention file! Use with care.
	EndpointReadStateInformation
	// POST /system/cmd/restart_process Sends the RESTART_PROCESS command.
	EndpointRestartProcess
	// POST /system/cmd/restart_program Restarts the Naemon process.
	EndpointRestartProgram
	// POST /system/cmd/save_state_information Causes Naemon to save all current monitoring status information to the state retention file. Normally, state retention
	EndpointSaveStateInformation
	// POST /system/cmd/shutdown_process Sends the SHUTDOWN_PROCESS command.
	EndpointShutdownProcess
	// POST /system/cmd/shutdown_program Shuts down the Naemon process.
	EndpointShutdownProgram
	// POST /system/cmd/start_accepting_passive_host_checks Sends the START_ACCEPTING_PASSIVE_HOST_CHECKS command.
	EndpointStartAcceptingPassiveHostChecks
	// POST /system/cmd/start_accepting_passive_svc_checks Sends the START_ACCEPTING_PASSIVE_SVC_CHECKS command.
	EndpointStartAcceptingPassiveSVCChecks
	// POST /system/cmd/start_executing_host_checks Sends the START_EXECUTING_HOST_CHECKS command.
	EndpointStartExecutingHostChecks
	// POST /system/cmd/start_executing_svc_checks Sends the START_EXECUTING_SVC_CHECKS command.
	EndpointStartExecutingSVCChecks
	// POST /system/cmd/start_obsessing_over_host_checks Sends the START_OBSESSING_OVER_HOST_CHECKS command.
	EndpointStartObsessingOverHostChecks
	// POST /system/cmd/start_obsessing_over_svc_checks Sends the START_OBSESSING_OVER_SVC_CHECKS command.
	EndpointStartObsessingOverSVCChecks
	// POST /system/cmd/stop_accepting_passive_host_checks Sends the STOP_ACCEPTING_PASSIVE_HOST_CHECKS command.
	EndpointStopAcceptingPassiveHostChecks
	// POST /system/cmd/stop_accepting_passive_svc_checks Sends the STOP_ACCEPTING_PASSIVE_SVC_CHECKS command.
	EndpointStopAcceptingPassiveSVCChecks
	// POST /system/cmd/stop_executing_host_checks Sends the STOP_EXECUTING_HOST_CHECKS command.
	EndpointStopExecutingHostChecks
	// POST /system/cmd/stop_executing_svc_checks Sends the STOP_EXECUTING_SVC_CHECKS command.
	EndpointStopExecutingSVCChecks
	// POST /system/cmd/stop_obsessing_over_host_checks Sends the STOP_OBSESSING_OVER_HOST_CHECKS command.
	EndpointStopObsessingOverHostChecks
	// POST /system/cmd/stop_obsessing_over_svc_checks Sends the STOP_OBSESSING_OVER_SVC_CHECKS command.
	EndpointStopObsessingOverSVCChecks
	// GET /thruk hash of basic information about this thruk instance
	EndpointGetThrukInfo
	// GET /thruk/api_keys lists api keys
	EndpointListAPIKeys
	// POST /thruk/api_keys create new api key.
	EndpointCreateAPIKey
	// GET /thruk/api_keys/<id> alias for /thruk/api_keys?hashed_key=<id>
	EndpointGetAPIKeyByID
	// DELETE /thruk/api_keys/<id> remove key for given id.
	EndpointDeleteAPIKeyByID
	// GET /thruk/bp lists business processes.
	EndpointListBusinessProcesses
	// POST /thruk/bp create new business process.
	EndpointCreateBusinessProcess
	// GET /thruk/bp/<nr> business processes for given number.
	EndpointGetBusinessProcessByID
	// POST /thruk/bp/<nr> update business processes configuration for given number.
	EndpointReplaceBusinessProcessConfig
	// PATCH /thruk/bp/<nr> update business processes configuration partially for given number.
	EndpointPatchBusinessProcessConfig
	// DELETE /thruk/bp/<nr> remove business processes for given number.
	EndpointDeleteBusinessProcess
	// POST /thruk/bp/<nr>/refresh recalculate business processes status for given number.
	EndpointRefreshBusinessProcess
	// GET /thruk/broadcasts lists broadcasts
	EndpointListBroadcasts
	// POST /thruk/broadcasts create new broadcast.
	EndpointCreateBroadcast
	// GET /thruk/broadcasts/<file> alias for /thruk/broadcasts?file=<file>
	EndpointGetBroadcastByFile
	// POST /thruk/broadcasts/<file> update entire broadcast for given file.
	EndpointReplaceBroadcastConfig
	// PATCH /thruk/broadcasts/<file> update attributes for given broadcast.
	EndpointPatchBroadcastConfig
	// DELETE /thruk/broadcasts/<file> remove broadcast for given file.
	EndpointDeleteBroadcast
	// GET /thruk/cluster lists cluster nodes
	EndpointListClusterNodes
	// GET /thruk/cluster/<id> return cluster state for given node.
	EndpointGetClusterNodeState
	// GET /thruk/cluster/heartbeat should not be used, use POST method instead
	EndpointGetClusterHeartbeatDeprecated
	// POST /thruk/cluster/heartbeat send cluster heartbeat to all other nodes
	EndpointSendClusterHeartbeat
	// POST /thruk/cluster/restart restarts all cluster nodes sequentially
	EndpointRestartClusterNodes
	// GET /thruk/config lists configuration information
	EndpointGetThrukConfig
	// GET /thruk/jobs lists thruk jobs.
	EndpointListThrukJobs
	// GET /thruk/jobs/<id> get thruk job status for given id.
	EndpointGetThrukJobStatus
	// GET /thruk/jobs/<id>/output get thruk job output for given id.
	EndpointGetThrukJobOutput
	// GET /thruk/logcache/stats lists logcache statistics
	EndpointGetLogCacheStats
	// POST /thruk/logcache/update runs the logcache delta update.
	EndpointRunLogCacheDeltaUpdate
	// GET /thruk/metrics alias for /thruk/stats
	EndpointGetThrukMetrics
	// GET /thruk/panorama lists all panorama dashboards.
	EndpointListPanoramaDashboards
	// GET /thruk/panorama/<nr> returns panorama dashboard for given number.
	EndpointGetPanoramaDashboard
	// POST /thruk/panorama/<nr>/maintenance Puts given dashboard into maintenance mode.
	EndpointEnablePanoramaDashboardMaintenance
	// DELETE /thruk/panorama/<nr>/maintenance removes maintenance mode from given dashboard.
	EndpointDisablePanoramaDashboardMaintenance
	// GET /thruk/recurring_downtimes lists recurring downtimes.
	EndpointListRecurringDowntimes
	// POST /thruk/recurring_downtimes create new downtime.
	EndpointCreateRecurringDowntime
	// GET /thruk/recurring_downtimes/<file> alias for /thruk/recurring_downtimes?file=<file>
	EndpointGetRecurringDowntimeByFile
	// POST /thruk/recurring_downtimes/<file> update entire downtime for given file.
	EndpointReplaceRecurringDowntimeConfig
	// PATCH /thruk/recurring_downtimes/<file> update attributes for given downtime.
	EndpointPatchRecurringDowntimeConfig
	// DELETE /thruk/recurring_downtimes/<file> remove downtime for given file.
	EndpointDeleteRecurringDowntime
	// GET /thruk/reports list of reports.
	EndpointListReports
	// POST /thruk/reports create new report.
	EndpointCreateReport
	// GET /thruk/reports/<nr> report for given number.
	EndpointGetReport
	// POST /thruk/reports/<nr> update entire report for given number.
	EndpointReplaceReportConfig
	// PATCH /thruk/reports/<nr> update attributes for given number.
	EndpointPatchReportConfig
	// DELETE /thruk/reports/<nr> remove report for given number.
	EndpointDeleteReport
	// POST /thruk/reports/<nr>/generate generate report for given number.
	EndpointGenerateReport
	// GET /thruk/reports/<nr>/report return the actual report file in binary format.
	EndpointGetReportFile
	// GET /thruk/sessions lists thruk sessions.
	EndpointListThrukSessions
	// GET /thruk/sessions/<id> get thruk sessions status for given id.
	EndpointGetThrukSessionStatus
	// GET /thruk/stats lists thruk statistics.
	EndpointGetThrukStats
	// GET /thruk/users lists thruk user profiles.
	EndpointListThrukUsers
	// GET /thruk/users/<id> get thruk profile for given user.
	EndpointGetThrukUserProfile
	// POST /thruk/users/<id>/cmd/lock lock given thruk user.
	EndpointLockThrukUser
	// POST /thruk/users/<id>/cmd/unlock unlock given thruk user.
	EndpointUnlockThrukUser
	// GET /thruk/whoami show current profile information.
	EndpointGetMyProfile
	// GET /timeperiods lists livestatus timeperiods.
	EndpointListTimeperiods
	// GET /timeperiods/<name> lists timeperiods for given name.
	EndpointListTimeperiodByName
	// GET /timeperiods/<name>/config Returns configuration for given timeperiod.
	EndpointGetTimeperiodConfig
	// POST /timeperiods/<name>/config Replace timeperiod configuration completely, use PATCH to only update specific attributes.
	EndpointReplaceTimeperiodConfig
	// PATCH /timeperiods/<name>/config Update timeperiods configuration partially.
	EndpointPatchTimeperiodConfig
	// DELETE /timeperiods/<name>/config Deletes given timeperiod from configuration.
	EndpointDeleteTimeperiodConfig
)
