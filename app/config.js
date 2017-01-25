
var config = {}

config.controller = {
  connections: [{
    // 0
    connectionID: 'isn',
    enabled: true,
    connectionKey: 'isn1',
    config: {
      username: 'c00001',
      password: '1234aaaa',
      eventScheduleId: 2,
      sportId: 1,
      momentFormatStr: 'LTS',
      errorReconnectDuration: 5000,
      eventUpdateDuration: 20000,
      eventPriceUpdateDuration: 2000,
      apiKeyDuration: 12000
    }
  },
  {
    connectionID: 'pinbet',
    enabled: true,
    connectionKey: 'pinbet1',
    config: {
      username: 'hc202fc111',
      password: '1234QQqq',
      momentFormatStr: 'LTS',
      errorReconnectDuration: 5000,
      leagueUpdateDuration: 30000,
      eventUpdateDuration: 5000,
      eventPriceUpdateDuration: 5000,
      eventUpdateRetryDuration : 1000,
      leagueUpdateRetryDuration : 1000,
      eventPriceUpdateRetryDuration : 1000
    }
  }],
  view: {
    connections: {
      pinbet:
        {connectionName: 'Pinacle',
          chipShortForm: 'PIN',
          chipColor: 'red'},
      isn:
        {connectionName: 'ISN',
        chipShortForm: 'ISN',
        chipColor: 'blue'}
    }
  },
  strategy: {
  }
}

module.exports = config
