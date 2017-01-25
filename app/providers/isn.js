'use strict'

const _ = require('lodash')
// const rp = require('request-promise')
const rp = require('request-promise-native')
var numeral = require('numeral')
// const ReactDataGridPlugins = require('react-data-grid/addons')

var isn = (function () {
  function isn () {
    this.config = {}
    this._key = ''
    this._username = ''
    this.eventList = []
    this.updateEventListTimeout = null
    this.updateEventPriceTimeout = null
    this.updateAPIKeyTimeout = null
    this.resetTimeout = null
    this.refreshTimeout = null
    this._infoHandler = null
    this.providerCode = 'isn'
    this.gameIdToGameType = {}
    this.marketSelectionIdToGameTypeStr = {}
    this.isEventListFirstCallCompleted = false
    this.isEventPriceFirstCallCompleted = false
    this.previousEventPriceResponse = ''
    this.previousEventResponse = ''

    this.isLogInReady = false
    this.isAPIKeyReady = false
    this.isMemberInfoReady = false

    this.defaultOptions = {
      json: true // Automatically parses the JSON string in the response
    }

    this.isReady = function () {
      return true
    }
    this.setInfoHandler = function (ph) {
      this._infoHandler = ph;
    }
    this.setProviderKey = function (key) {
      this._providerKey = key;
    }
    this.setConfig = function (config) {
      this.config = config;

      this.loginOptions = _.extend({}, this.defaultOptions, {
        method: 'post',
        headers: {
          'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: 'userName=' + this.config.username + '&password=' + this.config.password
      });
      this.apiKeyOptions = _.extend({}, this.defaultOptions, {
        method: 'GET',
        headers: {
          userId: '',
          memberToken: ''
        }
      });
      this.apiOptions = _.extend({}, this.apiKeyOptions, {
        method: 'GET',
        headers: {
          apiKey: ''
        }
      });
      this.memberInfoOptions = {
        lastRequestKey: '',
        oddsGroupId: '',
        binaryOddsFormat: ''

      }
    }

    this.callAPIGetEventList = function () {
      if (!(this.isLoggedIn && this.isAPIKeyReady && this.isMemberInfoReady)) {
        console.log('callAPIGetEventList failed. isLoggedIn %s, isAPIKeyReady %s, isMemberInfoReady %s', this.isLoggedIn, this.isAPIKeyReady, this.isMemberInfoReady)
        this.updateEventListTimeout = setTimeout(_.bind(this.callAPIGetEventList, this), 100)
        return
      }
      var eventArr = {}
      // rp(_.extend({}, this.apiOptions, { url: ('http://www.apiisn.com/betting/api/event/list/' + this.config.sportId + '/' + this.config.eventScheduleId) })).promise().bind(this).then(function (response) {
      fetch('http://www.apiisn.com/betting/api/event/list/' + this.config.sportId + '/' + this.config.eventScheduleId, _.extend({}, this.apiOptions))
      .then((response) => {return response.json()})
      .then((response) => {
        var responseStr = JSON.stringify(response)
        if (responseStr === this.previousEventResponse) {
          console.log('eventJson is same')
        } else {
          console.log('eventJson is diff')
          var diffCount = 0
          this.previousEventResponse = responseStr
          eventArr = {}
          var leagueCode = ''
          var gameTypeStr = ''
          _.each(response, _.bind(function (league) {
            leagueCode = this.providerCode + '-' + league.leagueName
            this._infoHandler.delaySetLeague(this.providerCode, leagueCode, league.leagueName)
            _.each(league.events, _.bind(function (event) {
              this._infoHandler.delaySetEvent(this.providerCode, leagueCode, event.id, event.homeTeamName, event.awayTeamName, '0', {event: event})
              // console.log('%s - %s vs %s', row.leagueName, event.homeTeamName, event.awayTeamName)
              _.each(event.markets, _.bind(function (market) {
                gameTypeStr = ''
                if (this.gameIdToGameType) {
                  this.gameIdToGameType[String(market.id)] = []
                }

                switch (market.marketType) {
                  case 'HT OU' :
                  case 'OU' :
                    _.each(market.marketLines, _.bind(function (marketLine) {
                      var overIdx = _.findIndex(marketLine.marketSelections, {name: 'Over'})
                      var underIdx = _.findIndex(marketLine.marketSelections, {name: 'Under'})
                      if (overIdx < 0 || underIdx < 0) {
                        console.error('Over/under not found')
                      } else {
                        var gamePeriod = (_.includes(market.marketType, 'HT') ? 1 : 0)
                        gameTypeStr = this._infoHandler.encodeGameType(gamePeriod, 'all', 'ou', numeral(Number(marketLine.marketSelections[overIdx].handicap)).format('0.00'))
                        this.gameIdToGameType[String(market.id)][0] = marketLine.marketSelections[overIdx].marketSelectionId
                        this.gameIdToGameType[String(market.id)][1] = marketLine.marketSelections[underIdx].marketSelectionId
                        this.marketSelectionIdToGameTypeStr[marketLine.marketSelections[overIdx].marketSelectionId] = gameTypeStr
                        this.marketSelectionIdToGameTypeStr[marketLine.marketSelections[underIdx].marketSelectionId] = gameTypeStr
                        this._infoHandler.delaySetGame(this.providerCode, event.id, market.id, gameTypeStr, {market: market, marketLine: marketLine})
                      }
                    }, this))
                    break
                  case 'HT AH' :
                  case 'AH' :
                    _.each(market.marketLines, _.bind(function (marketLine) {
                      var homeIdx = _.findIndex(marketLine.marketSelections, {name: event.homeTeamName})
                      var awayIdx = _.findIndex(marketLine.marketSelections, {name: event.awayTeamName})
                      if (homeIdx < 0 || awayIdx < 0) {
                        console.error('home/away team not found')
                      } else {
                        var gamePeriod = (_.includes(market.marketType, 'HT') ? 1 : 0)
                        gameTypeStr = this._infoHandler.encodeGameType(gamePeriod, 'all', 'handicap', numeral(Number(marketLine.marketSelections[homeIdx].handicap)).format('0.00'))
                        this.gameIdToGameType[String(market.id)][0] = marketLine.marketSelections[homeIdx].marketSelectionId
                        this.gameIdToGameType[String(market.id)][1] = marketLine.marketSelections[awayIdx].marketSelectionId
                        this.marketSelectionIdToGameTypeStr[marketLine.marketSelections[homeIdx].marketSelectionId] = gameTypeStr
                        this.marketSelectionIdToGameTypeStr[marketLine.marketSelections[awayIdx].marketSelectionId] = gameTypeStr
                        this._infoHandler.delaySetGame(this.providerCode, event.id, market.id, gameTypeStr, {market: market, marketLine: marketLine})
                      }
                    }, this))
                    break
                }
                /*
                _.each(market.marketSelections, _.bind(function (marketSelection) {
                  var idx = _.findIndex(this.eventList, {marketSelectionId: marketSelection.marketSelectionId})
                  // console.log('event idx: %d', idx)
                  if (idx < 0) {
                    diffCount++
                    this.priceHandler.setOdds(this.providerCode, event.id, market.id, marketSelection.marketSelectionId, idx, spread.home, period.cutoff, {eventId:event.id, period:{lineId: period.lineId, number: period.number, cutoff: period.cutoff}, spread:spread})

                    eventArr = {nativeOdds: 0.0, lastUpdate: m, addDatetime: m, handicap: 0.0, marketTypeId: market.marketTypeId, marketSelectionId: marketSelection.marketSelectionId, marketType: market.marketType, marketSelectionName: marketSelection.name, league: league.leagueName, homeTeam: event.homeTeamName, awayTeam: event.awayTeamName}
                    this.eventList.push(eventArr)
                  }
                }, this))
                _.each(market.marketLines, _.bind(function (marketLine) {
                  _.each(marketLine.marketSelections, _.bind(function (marketSelection) {
                    var idx = _.findIndex(this.eventList, {marketSelectionId: marketSelection.marketSelectionId})
                    // console.log('event idx: %d', idx)
                    if (idx < 0) {
                      diffCount++
                      // eventList.slice(idx, 1)
                      eventArr = {nativeOdds: 0.0, lastUpdate: m, addDatetime: m, handicap: Number(marketSelection.handicap), marketTypeId: market.marketTypeId, marketSelectionId: marketSelection.marketSelectionId, marketType: market.marketType, marketSelectionName: marketSelection.name, league: row.leagueName, homeTeam: event.homeTeamName, awayTeam: event.awayTeamName}
                      // TODO: pass it to priceHandler
                      this.eventList.push(eventArr)
                    }
                  }, this))
                }, this))
                */
              }, this))
            }, this))
          }, this))
          this._infoHandler.flushEvent()
          this._infoHandler.flushLeague()
          this._infoHandler.flushGame()
          this.isEventPriceFirstCallCompleted = true
          console.log('event diffcount: %d', diffCount)
        }
        this.updateEventListTimeout = setTimeout(_.bind(this.callAPIGetEventList, this), this.config.eventUpdateDuration)
      }).catch(function (err) {
        console.log(err)
        this.refreshTimeout = setTimeout(_.bind(this.refresh, this), 1)
      })
      console.log('end updateEventList')
    }

    this.callAPIGetEventPrice = function () {
      // console.log('in updateEventPriceList')
      // console.log('lastRequestKey: %s, %s', this.memberInfoOptions.lastRequestKey, this.isEventReady)
      if (this.isLoggedIn && this.isAPIKeyReady && this.isMemberInfoReady && this.isEventListFirstCallCompleted) {
        console.log('callAPIGetEventPrice not ready, isLoggedIn: %s, isAPIKeyReady: %s, isMemberInfoReady: %s, isEventListFirstCallCompleted: %s', this.isLoggedIn, this.isAPIKeyReady, this.isMemberInfoReady, this.isEventListFirstCallCompleted)
        this.updateEventPriceTimeout = setTimeout(_.bind(this.callAPIGetEventPrice, this), 100)
        return
      }
      // rp(_.extend({}, this.apiOptions, {url: 'http://www.apiisn.com/betting/api/event/pricelist/' + this.config.sportId + '/' + this.memberInfoOptions.oddsGroupId + '/' + this.memberInfoOptions.binaryOddsFormat + '/' + this.config.eventScheduleId + '/' + this.memberInfoOptions.lastRequestKey})).promise().bind(this).then(function (response) {
      fetch('http://www.apiisn.com/betting/api/event/pricelist/' + this.config.sportId + '/' + this.memberInfoOptions.oddsGroupId + '/' + this.memberInfoOptions.binaryOddsFormat + '/' + this.config.eventScheduleId + '/' + this.memberInfoOptions.lastRequestKey, _.extend({}, this.apiOptions))
      .then((response) => {return response.json()})
      .then((response) => {
        var responseStr = JSON.stringify(response.priceList)
        if (responseStr === this.previousEventPriceResponse) {
          // console.log('eventPirceList is same')
        } else {
          // console.log('eventPirceList is diff')
          // console.log('responseStr.length : %d, this.previousEeventPriceResponse.length : %d', responseStr.length, this.previousEventPriceResponse.length)
          this.previousEventPriceResponse = responseStr
          var tmpIdx
          var gameTypeStr = null
          _.each(response.priceList, _.bind(function (price) {
            gameTypeStr = this.marketSelectionIdToGameTypeStr[price.marketSelectionId]
            tmpIdx = _.indexOf(this.gameIdToGameType[String(price.marketId)], price.marketSelectionId)
            if (tmpIdx > -1 && _.isString(gameTypeStr) && !_.isNull(gameTypeStr)) {
              this._infoHandler.delaySetOdds(this.providerCode, price.eventId, price.marketId, gameTypeStr, price.marketSelectionId, tmpIdx, price.decimalOdds, -1, price)
            } else {
              // TODO check what if there are not found case
              // not found
            }
            gameTypeStr = null
          }, this))
          this._infoHandler.flushOdds()
        }
        this.memberInfoOptions.lastRequestKey = response.lastRequestKey
        this.updateEventPriceTimeout = setTimeout(_.bind(this.callAPIGetEventPrice, this), this.config.eventPriceUpdateDuration)
      }).catch((err) => {
        console.log(err)
        this.refreshTimeout = setTimeout(_.bind(this.refresh, this), this.config.errorReconnectDuration)
      })
      // console.log('end updateEventPrice')
    }

    this.refresh = function (activateTimeout = false) {
      clearTimeout(this.updateAPIKeyTimeout)
      if (this.isLoggedIn) {
        if (activateTimeout) {
          clearTimeout(this.updateEventListTimeout)
          clearTimeout(this.updateEventPriceTimeout)
        }
        this.isAPIKeyReady = false
        this.isMemberInfoReady = false
        console.log('callAPIGetAPIKey')
        // rp(_.extend({}, this.apiKeyOptions, {url: 'http://www.apiisn.com/betting/api/member/apikey'})).promise().bind(this).then(function (response) {
        fetch('http://www.apiisn.com/betting/api/member/apikey', _.extend({}, this.apiKeyOptions)).then(response => {return response.json()})
          .then((response) => {
            // console.log('User API success: %s ', response.apiKey)
            this.apiOptions.headers.apiKey = response.apiKey
            this.isAPIKeyReady = true
            this.updateAPIKeyTimeout = setTimeout(_.bind(this.refresh, this), this.config.apiKeyDuration)
            // return rp(_.extend({}, this.apiOptions, {uri: 'http://www.apiisn.com/betting/api/member/info'})).promise().bind(this)
            console.log('would return a promise')
            return fetch('http://www.apiisn.com/betting/api/member/info', _.extend({}, this.apiOptions)).then(result => {return result.json()})
            // updateEventTimeout = setTimeout(updateEventList, 1, false)
        }).then((response) => {
          console.log('User info success')
          console.log(response)
          this.memberInfoOptions.binaryOddsFormat = response['binaryOddsFormat']
          this.memberInfoOptions.oddsGroupId = response['oddsGroupId']
          this.isMemberInfoReady = true
          if (activateTimeout) {
            this.updateEventListTimeout = setTimeout(_.bind(this.callAPIGetEventList, this), 1)
            this.updateEventPriceTimeout = setTimeout(_.bind(this.callAPIGetEventPrice, this), 1)
          }
          return true
        }).catch((err) => {
          console.error(err)
          if (!_.isUndefined(this.refreshTimeout) && !_.isNull(this.refreshTimeout)) clearTimeout(this.refreshTimeout)
          this.refreshTimeout = setTimeout(_.bind(this.reset, this), this.config.errorReconnectDuration)
        })
      }
    }
    this.reset = () => {
      this.isLoggedIn = false
      this.isAPIKeyReady = false
      this.isMemberInfoReady = false
      clearTimeout(this.updateAPIKeyTimeout)
      clearTimeout(this.updateEventListTimeout)
      clearTimeout(this.updateEventPriceTimeout)
      clearTimeout(this.refreshTimeout)
      clearTimeout(this.resetTimeout)
      // rp(_.extend({}, this.loginOptions, {url: 'http://www.apiisn.com/betting/api/member/login'})).then((response) => {
      fetch('http://www.apiisn.com/betting/api/member/login', _.extend({}, this.loginOptions ))
      .then(response => {return response.json()})
      .then(response => {
        console.log('User login success: %s ', response.userId)
        this.apiKeyOptions.headers.userId = response.userId
        this.apiKeyOptions.headers.memberToken = response.memberToken
        this.apiOptions.headers.userId = response.userId
        this.apiOptions.headers.memberToken = response.memberToken
        this.memberInfoOptions.lastRequestKey = response.lastRequestKey
        this.isLoggedIn = true
        // updateAPIKeyTimeout = setTimeout(updateAPIKey, 1)
        setTimeout(_.bind(this.refresh, this), 1, true)
      }).catch((err) => {

        setTimeout(_.bind(this.reset, this), this.config.errorReconnectDuration)
        console.error(err)
      })
    }

    this.start = function () {
      this.reset()
      return true
    }
  }
  return isn
})()
// var exa = ReactDOM.render(<Example />, document.getElementById('content2'))
module.exports = isn
