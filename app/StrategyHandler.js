'use strict'


const _ = require('lodash')
const { requireTaskPool } = global.require('electron-remote')
const shremote = requireTaskPool(global.require.resolve('./StrategyHandlerRemote'))

var StrategyHandler = (function () {
  function StrategyHandler () {
    this.config = {}
    this.infoHandler = null
    this.eventGroupsCache = {}

    this.buildCache = () => {
      this.eventGroupsCache = {}
      _.each(this.infoHandler.eventGroupObjArr, (eventGroupObj) => {
        _.each(eventGroupObj.events, (event) => {
          if (!(event.providerCode in this.eventGroupsCache)) this.eventGroupsCache[event.providerCode] = {}
          this.eventGroupsCache[event.providerCode][event.eventCode] = eventGroupObj
        })
      })
      console.log('strategyHandler cache built')
      console.log(_.size(this.eventGroupsCache))
    }
    this.init = () => {
      console.log('strategyHandler->init')
    }
    this.start = () => {
      this.buildCache()
      this.findBettingFromEventGroups(this.infoHandler.eventGroupObjArr)
    }
    this.setInfoHandler = function (handler) {
      this.infoHandler = handler
      handler.addEventGroupUpdateCallback((callbackObj) => this.eventGroupUpdate(callbackObj))
      handler.addGameUpdateCallback((callbackObj) => this.gameUpdate(callbackObj))
      handler.addOddsUpdateCallback((callbackObj) => this.oddsUpdate(callbackObj))
    }

    this.setConfig = function (config) {
      this.config = config
      return true
    }
    this.checkGame = function (gamesArr) {

    }
    this.gameUpdate = (callbackObj) => {
      console.log('gameUpdate')
      var eventGroupObjs = []
      /*
      _.each(['inserted', 'updated'], (key) => {
        var gameObjArr = callbackObj[key]
        _.each(gameObjArr, (gameObj) => {
          if (typeof this.eventGroupsCache[gameObj.providerCode] !== 'undefined' && typeof this.eventGroupsCache[gameObj.providerCode][gameObj.eventCode] !== 'undefined') {
            eventGroupObjs.push(this.eventGroupsCache[gameObj.providerCode][gameObj.eventCode])
          } else {
            // console.log('oddUpdate->eventGroup not monitor')
          }
        })
      })
      */

      shremote.generateEventGroupArrFromCache(this.eventGroupsCache, callbackObj)
        .then((result) => {
          // console.log(result)
          this.findBettingFromEventGroups(result['eventGroupObjs'])
        })
    }

    this.oddsUpdate = (callbackObj) => {
      console.log('oddUpdate')
      var eventGroupObjs = []
      /*
      _.each(['inserted', 'updated'], (key) => {
        var oddsObjArr = callbackObj[key]
        _.each(oddsObjArr, (oddsObj) => {
          if (typeof this.eventGroupsCache[oddsObj.providerCode] !== 'undefined' && typeof this.eventGroupsCache[oddsObj.providerCode][oddsObj.eventCode] !== 'undefined') {
            eventGroupObjs.push(this.eventGroupsCache[oddsObj.providerCode][oddsObj.eventCode])
          } else {
            // console.log('oddUpdate->eventGroup not monitor')
          }
        })
      })
      this.findBettingFromEventGroups(eventGroupObjs)
      */
      shremote.generateEventGroupArrFromCache(this.eventGroupsCache, callbackObj)
        .then((result) => {
          // console.log(result)
          this.findBettingFromEventGroups(result['eventGroupObjs'])
        })

      /*
      shremote.generateEventGroupArrFromCache(this.eventGroupsCache, callbackObj).then(result => {
        console.log(result)
        this.findBettingFromEventGroups(result)
      }).catch(err => {
        console.log(err)
      })
      */
    }

    this.eventGroupUpdate = (callbackObj) => {
      console.log('eventGroupUpdate')
      this.buildCache()
      _.each(['inserted', 'updated'], (key) => {
        var theEventGroups = callbackObj[key]
        this.findBettingFromEventGroups(theEventGroups)
      })
    }
    this.findBettingFromEventGroups = (eventGroupObjs) => {
      var gameArr = []
      var inEventGroupObjs = _.uniq(eventGroupObjs)
      _.each(inEventGroupObjs, (eventGroupObj) => {
        // console.log('gameUpdate->eventGroupFound')
        gameArr = []
        _.each(eventGroupObj.events, (event) => {
          gameArr = _.concat(gameArr, _.filter(this.infoHandler.gameObjArr, {eventCode: event.eventCode, providerCode: event.providerCode})) // get all objects belong to this event / provider
        })
        return new Promise((resolve, reject) => {
          this.findGamesForBetting(gameArr)
          resolve(true)
        })
      })
    }
    this.findGamesForBetting = (gameArr) => {
      // console.log('findGamesForBetting size:%d', gameArr.length)
      if (gameArr.length > 1) console.log(gameArr)
      var gameArrByGameTypeStr = _.groupBy(gameArr, 'gameTypeStr')
      var oddsArr = {}
      _.each(gameArrByGameTypeStr, (games, key) => {
        _.each(games, (game) => {
          if (!(game.gameTypeStr in oddsArr)) oddsArr[game.gameTypeStr] = []
          oddsArr[game.gameTypeStr] = _.concat(oddsArr[game.gameTypeStr], _.filter(this.infoHandler.oddsObjArr, {providerCode: game.providerCode, gameCode: game.gameCode, gameTypeStr: game.gameTypeStr}))
        })
      })
      _.each(oddsArr, (odds, key) => {
        this.findOddsForBetting(odds)
      })
    }

    this.findOddsForBetting = (oddsArr) => {
      if (oddsArr.length > 1) {
        var lhsOdds = null
        while (oddsArr.length > 0) {
          // console.log('findOddsForBetting')
          lhsOdds = (_.pullAt(oddsArr, 0))[0]
          // console.log('lhsOdds')
          // console.log(lhsOdds)
          _.each(oddsArr, (rhsOdds) => {
            // console.log(rhsOdds)
            if (lhsOdds.providerCode !== rhsOdds.providerCode && lhsOdds.homeOrAway !== rhsOdds.homeOrAway) {
              // console.log('rhsOdds')
              // console.log('match: %.3f + %.3f = %.3f', lhsOdds.odds, rhsOdds.odds, lhsOdds.odds + rhsOdds.odds)
              if (lhsOdds.odds + rhsOdds.odds >= 4.00) {
                console.log('4 found')
              }
            }
          })
        }
      }
    }
  }

  return StrategyHandler
})()
module.exports = StrategyHandler
