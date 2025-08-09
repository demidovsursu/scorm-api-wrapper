/*global define, module */

/* ===========================================================

pipwerks SCORM Wrapper for JavaScript
v2.0.20250729

Created by Philip Hutchison, January 2008-2018
https://github.com/pipwerks/scorm-api-wrapper

Copyright (c) Philip Hutchison
MIT-style license: http://pipwerks.mit-license.org/

This wrapper works with both SCORM 1.2 and SCORM 2004.

Inspired by APIWrapper.js, created by the ADL and
Concurrent Technologies Corporation, distributed by
the ADL (http://www.adlnet.gov/scorm).

SCORM.API.find() and SCORM.API.get() functions based
on ADL code, modified by Mike Rustici
(http://www.scorm.com/resources/apifinder/SCORMAPIFinder.htm),
further modified by Philip Hutchison


further modified by Andrey Demidov, 2025


=============================================================== */

(function(root, factory) {

    "use strict";

    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.pipwerks = factory();
    }
}(this, function() {

    "use strict";

    const pipwerks = {}; //pipwerks 'namespace' helps ensure no conflicts with possible other "SCORM" variables
    pipwerks.UTILS = {}; //For holding UTILS functions
    pipwerks.debug = { isActive: false }; //Enable (true) or disable (false) for debug mode

    pipwerks.SCORM = { //Define the SCORM object
        version: null, //Store SCORM version.
        handleCompletionStatus: true, //Whether or not the wrapper should automatically handle the initial completion status
        handleExitMode: true, //Whether or not the wrapper should automatically handle the exit mode
        API: {
            handle: null,
            isFound: false,
            GetValue: null,
            SetValue: null,
            Initialize: null,
            Terminate: null,
            Commit: null,
            GetLastError: null,
            GetErrorString: null,
            GetDiagnostic:null,
            model: null
        }, //Create API child object
        connection: { isActive: false }, //Create connection child object
        data: {
            completionStatus: null,
            exitStatus: null,
            learner: { id: null, name: null, language: null},
            progress: { measure: 0, data: null, location: null, save: true, passing: 1.0 },
            score: { min: 0, max: 100, raw: null, scaled: 0.0, passing: 0.75 },
            time: { total: 0.0, startAt: null, endAt: null },
            objectives: [ {id:'primary', progress: {measure:0, passing: 1.0}, status: '', score: {min:0, max: 100, raw: null, scaled: 0.0, passing: 0.75}, save: false} ],

        }, //Create data child object
        debug: {} //Create debug child object
    };

    /* --------------------------------------------------------------------------------
       pipwerks.SCORM.isAvailable
       A simple function to allow Flash ExternalInterface to confirm
       presence of JS wrapper before attempting any LMS communication.

       Parameters: none
       Returns:    Boolean (true)
    ----------------------------------------------------------------------------------- */

    pipwerks.SCORM.isAvailable = function() {
        return true;
    };


    // ------------------------------------------------------------------------- //
    // --- SCORM.API functions ------------------------------------------------- //
    // ------------------------------------------------------------------------- //

    /* -------------------------------------------------------------------------
       pipwerks.SCORM.API.find(window)
       Looks for an object named API in parent and opener windows

       Parameters: window (the browser window object).
       Returns:    Object if API is found, null if no API found
    ---------------------------------------------------------------------------- */

    pipwerks.SCORM.API.find = function(win) {

        let API = null,
            findAttempts = 0,
            findAttemptLimit = 500,
            traceMsgPrefix = "SCORM.API.find",
            trace = pipwerks.UTILS.trace,
            scorm = pipwerks.SCORM;

        while ((!win.API && !win.API_1484_11) &&
            (win.parent) &&
            (win.parent !== win) &&
            (findAttempts <= findAttemptLimit)) {

            findAttempts++;
            win = win.parent;

        }

        //If SCORM version is specified by user, look for specific API
        if ((scorm.version=="2004" || !scorm.version) && win.API_1484_11) { //SCORM 2004-specific API.
            scorm.version = "2004"; //Set version
            API = win.API_1484_11;
            scorm.API.Initialize=API.Initialize;
            scorm.API.GetValue=API.GetValue;
            scorm.API.SetValue=API.SetValue;
            scorm.API.Commit=API.Commit;
            scorm.API.Terminate=API.Terminate;
            scorm.API.GetLastError=API.GetLastError;
            scorm.API.GetErrorString=API.GetErrorString;
            scorm.API.GetDiagnostic=API.GetDiagnostic;
            scorm.data.progress.save=false;
            scorm.API.model={
               exit: "cmi.exit",
               exit_normal: "",
               exit_suspend: "suspend",
               status: "cmi.completion_status",
               learner_id: "cmi.learner_id",
               learner_name: "cmi.learner_name",
               learner_language: "cmi.learner_preference.language",
               progress: "cmi.progress_measure",
               suspend_data: "cmi.suspend_data",
               total_time: "cmi.total_time",
               session_time: "cmi.session_time",
               passing_status: "cmi.scaled_passing_score",
               raw_score: "cmi.score.raw",
               min_score: "cmi.score.min",
               max_score: "cmi.score.max",
               scaled_score: "cmi.score.scaled",
               location: "cmi.location"
            };
        } else if ((scorm.version=="1.2" || !scorm.version) && win.API) { //SCORM 1.2-specific API
            scorm.version = "1.2"; //Set version
            API = win.API;
            scorm.API.Initialize=API.LMSInitialize;
            scorm.API.GetValue=API.LMSGetValue;
            scorm.API.SetValue=API.LMSSetValue;
            scorm.API.Commit=API.LMSCommit;
            scorm.API.Terminate=API.LMSFinish;
            scorm.API.GetLastError=API.LMSGetLastError;
            scorm.API.GetErrorString=API.LMSGetErrorString;
            scorm.API.GetDiagnostic=API.LMSGetDiagnostic;
            scorm.API.model={
               exit: "cmi.core.exit",
               exit_normal: "logout",
               exit_suspend: "suspend",
               status: "cmi.core.lesson_status",
               learner_id: "cmi.core.student_id",
               learner_name: "cmi.core.student_name",
               learner_language: "cmi.student_preference.language",
               progress: "",
               suspend_data: "cmi.suspend_data",
               total_time: "cmi.core.total_time",
               session_time: "cmi.core.session_time",
               passing_status: "",
               raw_score: "cmi.core.score.raw",
               min_score: "cmi.core.score.min",
               max_score: "cmi.core.score.max",
               scaled_score: "",
               location: "cmi.core.lesson_location"
            };
        }
        else if(!scorm.version) {
            trace(traceMsgPrefix + ": SCORM version "+scorm.version+" was specified by user, but API cannot be found.");
        }
        if (API) {

            trace(traceMsgPrefix + ": API found. Version: " + scorm.version);
            trace("API: " + API);

        } else {

            trace(traceMsgPrefix + ": Error finding API. \nFind attempts: " + findAttempts + ". \nFind attempt limit: " + findAttemptLimit);

        }

        return API;

    };


    /* -------------------------------------------------------------------------
       pipwerks.SCORM.API.get()
       Looks for an object named API, first in the current window's frame
       hierarchy and then, if necessary, in the current window's opener window
       hierarchy (if there is an opener window).

       Parameters:  None.
       Returns:     Object if API found, null if no API found
    ---------------------------------------------------------------------------- */

    pipwerks.SCORM.API.get = function() {

        let win = window,
            scorm = pipwerks.SCORM,
            find = scorm.API.find,
            trace = pipwerks.UTILS.trace;

        let API = find(win);

        if (!API && win.parent && win.parent !== win) {
            API = find(win.parent);
        }

        if (!API && win.top && win.top.opener) {
            API = find(win.top.opener);
        }

        if (!API && win.top && win.top.opener && win.top.opener.document) {
            API = find(win.top.opener.document);
        }

        if (API) {
            scorm.API.isFound = true;
        } else {
            trace("API.get failed: Can't find the API!");
        }
        return API;
    };


    /* -------------------------------------------------------------------------
       pipwerks.SCORM.API.getHandle()
       Returns the handle to API object if it was previously set

       Parameters:  None.
       Returns:     Object (the pipwerks.SCORM.API.handle variable).
    ---------------------------------------------------------------------------- */

    pipwerks.SCORM.API.getHandle = function() {

        const API = pipwerks.SCORM.API;
        if (!API.handle && !API.isFound) {
            API.handle = API.get();
        }
        return API.handle;
    };


    // ------------------------------------------------------------------------- //
    // --- pipwerks.SCORM.connection functions --------------------------------- //
    // ------------------------------------------------------------------------- //


    /* -------------------------------------------------------------------------
       pipwerks.SCORM.connection.initialize()
       Tells the LMS to initiate the communication session.

       Parameters:  None
       Returns:     Boolean
    ---------------------------------------------------------------------------- */

    pipwerks.SCORM.connection.initialize = function() {

        let success = false,
            scorm = pipwerks.SCORM,
            completionStatus = scorm.data.completionStatus,
            trace = pipwerks.UTILS.trace,
            makeBoolean = pipwerks.UTILS.StringToBoolean,
            debug = scorm.debug,
            traceMsgPrefix = "SCORM.connection.initialize ";

        trace("connection.initialize called.");

        scorm.data.time.startAt=(new Date()).getTime();

        if (!scorm.connection.isActive) {
            let API = scorm.API.getHandle(),
                errorCode = 0;

            if (API) {
                success = makeBoolean(scorm.API.Initialize.call(API,""));

                if (success) {
                    //Double-check that connection is active and working before returning 'true' boolean
                    errorCode = debug.getCode();

                    if (errorCode !== null && errorCode === 0) {
                        scorm.connection.isActive = true;
                        if(window.document && window.document.body) {
                          window.document.body.onunload=window.document.body.onbeforeunload=function(){ pipwerks.SCORM.scorm.connection.terminate(); }
                        }
                        let model=scorm.API.model;
                        scorm.data.learner.id = scorm.data.get(model.learner_id);
                        scorm.data.learner.name = scorm.data.get(model.learner_name);
                        scorm.data.learner.language = scorm.data.get(model.learner_language);
                        let ss=scorm.data.get(model.passing_status); 
                        if(ss) { 
                          scorm.data.progress.passing= +ss;
                        }
                        let objCount=scorm.data.get("cmi.objectives._count");
                        if(objCount!=null && objCount>0) {
                           for(let obj=0; obj<objCount; ++obj) {
                             let id=scorm.data.get("cmi.objectives."+obj.toString()+".id");
                             if(obj<scorm.data.objectives.length) {
                               scorm.data.objectives[obj].id=id;
                             } else {
                               scorm.data.objectives.push({id: id, progress: { measure: 0, passing: 1.0}, status: '', score: {min:0, max: 100, raw: null, scaled: 0.0, passing: 0.75}, save: false});
                             }
                           }
                        }
                        if (scorm.handleCompletionStatus) {
                            completionStatus = scorm.data.get(model.status);

                            if (completionStatus=="not attempted" || completionStatus=="unknown") {
                               scorm.data.set(model.status, "incomplete");
                               if(scorm.data.progress.save) scorm.save();
                            }
                            else {
                               scorm.data.progress.data = scorm.data.get(model.suspend_data);
                               scorm.data.progress.location = scorm.data.get(model.location);
                               scorm.data.time.total = pipwerks.UTILS.SCORMTime2ms(scorm.data.get(model.total_time));
                            }
                        }
                    } else {
                        success = false;
                        trace(traceMsgPrefix + "failed. \nError code: " + errorCode + " \nError info: " + debug.getInfo(errorCode));
                    }
                } else {
                    errorCode = debug.getCode();
                    if (errorCode !== null && errorCode !== 0) {
                        trace(traceMsgPrefix + "failed. \nError code: " + errorCode + " \nError info: " + debug.getInfo(errorCode));
                    } else {
                        trace(traceMsgPrefix + "failed: No response from server.");
                    }
                }
            } else {
                trace(traceMsgPrefix + "failed: API is null.");
            }
        } else {
            trace(traceMsgPrefix + "aborted: Connection already active.");
        }
        return success;

    };


    /* -------------------------------------------------------------------------
       pipwerks.SCORM.connection.terminate()
       Tells the LMS to terminate the communication session

       Parameters:  None
       Returns:     Boolean
    ---------------------------------------------------------------------------- */


    pipwerks.SCORM.connection.terminate = function() {

        let success = false,
            scorm = pipwerks.SCORM,
            exitStatus = scorm.data.exitStatus,
            completionStatus = scorm.data.completionStatus,
            trace = pipwerks.UTILS.trace,
            makeBoolean = pipwerks.UTILS.StringToBoolean,
            debug = scorm.debug,
            traceMsgPrefix = "SCORM.connection.terminate ",
            model=scorm.API.model;

        if (scorm.connection.isActive) {
            let API = scorm.API.getHandle(),
                errorCode = 0;

            if (API) {
                if (scorm.handleExitMode && !exitStatus) {

                    scorm.data.progress.save=false;
                    scorm.data.setprogress(scorm.data.progress.measure, scorm.data.progress.data);
                    if(scorm.data.score.raw!=null) {
                       scorm.data.set(model.min_score,scorm.data.score.min.toString());
                       scorm.data.set(model.max_score,scorm.data.score.max.toString());
                       scorm.data.set(model.raw_score,scorm.data.score.raw.toString());
                       scorm.data.set(model.scaled_score,scorm.data.score.scaled.toFixed(2).toString());
                    }
                    if(scorm.data.time.endAt==null) scorm.data.time.endAt=(new Date()).getTime();
                    scorm.data.set(model.session_time, pipwerks.UTILS.ms2SCORMTime(scorm.data.time.endAt - scorm.data.time.startAt));

                    if (scorm.data.progress.measure<1.0) {
                       success = scorm.data.set(model.exit, model.exit_suspend);
                    } else {
                       success = scorm.data.set(model.exit, model.exit_normal);
                    }
                    if(scorm.version=="2004") scorm.data.set("adl.nav.request",(scorm.data.progress.measure<1.0)?"suspendAll":"exitAll");
                }
                if(scorm.version!="2004") success = scorm.save();

                if (success) {
                    success = makeBoolean(scorm.API.Terminate.call(API,""));
                    if (success) {
                        scorm.connection.isActive = false;
                    } else {
                        errorCode = debug.getCode();
                        trace(traceMsgPrefix + "failed. \nError code: " + errorCode + " \nError info: " + debug.getInfo(errorCode));
                    }
                }

            } else {
                trace(traceMsgPrefix + "failed: API is null.");
            }

        } else {
            trace(traceMsgPrefix + "aborted: Connection already terminated.");
        }

        return success;

    };


    // ------------------------------------------------------------------------- //
    // --- pipwerks.SCORM.data functions --------------------------------------- //
    // ------------------------------------------------------------------------- //

    /* -------------------------------------------------------------------------
       pipwerks.SCORM.data.setscore(score)
       Set score, call before setprogress
       Score will sending to LMS on terminate

       Parameters: score (Number score.min...score.max)
       Returns:   Boolean
    ---------------------------------------------------------------------------- */

    pipwerks.SCORM.data.setscore=function(score) {
       let scorm = pipwerks.SCORM;
       scorm.data.score.raw=score;
       if(score!=null) scorm.data.score.scaled=(score-scorm.data.score.min)/(scorm.data.score.max-scorm.data.score.min);
       return true;
    }


    /* -------------------------------------------------------------------------
       pipwerks.SCORM.data.setobjetive(id, measure, score=null)
       Set progress and score of the objective with id or #

       Parameters: id (string or number)
                   measure (number 0..1)
                   score (Number score.min...score.max)
       Returns:   Boolean
    ---------------------------------------------------------------------------- */
    pipwerks.SCORM.data.setobjective=function(id, measure, score=null) {
      let scorm = pipwerks.SCORM, n=-1;
      if(typeof(id)=="string") {
        for(let obj=0;obj<scorm.data.objectives.length; ++obj) {
          if(scorm.data.objectives[obj].id==id) { n=obj; break; }
        }
      } else {
        n=id;
      }
      if(n<=0 || n>=scorm.data.objectives.length) return false;
      let objn=scorm.data.objectives[n];
      objn.progress.measure=measure;
      if(score!=null) {
        objn.score.raw=score;
        objn.score.scaled=(score-objn.score.min)/(obj.score.max-obj.score.min);
      }
      objn.save=true;
    }

    /* -------------------------------------------------------------------------
       pipwerks.SCORM.data.setprogress(measure, data=null, location=null)
       Send progress measure to LMS

       Parameters: measure (number 0..1)
                   data (string - any data to restore the savepoint in content)
                   location (string - any data to restore the savepoint in content)
       Returns:   Boolean
    ---------------------------------------------------------------------------- */

    pipwerks.SCORM.data.setprogress=function(measure, data=null, location=null) {
        let success = false,
            scorm = pipwerks.SCORM,
            trace = pipwerks.UTILS.trace,
            debug = scorm.debug,
            model=scorm.API.model;

        if (scorm.connection.isActive) {
          // save objectives progress and score
          for(let obj=0;obj<scorm.data.objectives.length; ++obj) {
            let objn=scorm.data.objectives[obj];
            if(objn.save) {
              let status="completed", objp="cmi.objectives."+obj.toString();
                
              if(objn.progress.measure>=objn.progress.passing) {
                if(objn.score.raw!=null) {
                  if(objn.score.scaled>=objn.score.passing)
                    status="passed";
                  else
                    status="failed";
                  scorm.data.set(objp+".score.min", objn.score.min.toString());
                  scorm.data.set(objp+".score.max", objn.score.max.toString());
                  scorm.data.set(objp+".score.raw", objn.score.raw.toString());
                  if(scorm.version=="2004") {
                    scorm.data.set(objp+".score.scaled", objn.score.scaled.toFixed(2).toString());
                    scorm.data.set(objp+".success_status", status);
                  }
                }
                if(scorm.version=="2004") {
                  scorm.data.set(objp+".completion_status", "completed");
                } else {
                  scorm.data.set(objp+".status", status);
                }
              } else {
                scorm.data.set(objp+(scorm.version=="2004"?".completion_status":".status"), "incomplete");
              }
              if(scorm.version=="2004") {
                scorm.data.set(objp+".progress_measure", objn.progress.measure.toFixed(2).toString());
              }
              objn.save=false;
            }
          }
          if(measure>=scorm.data.progress.passing) {
             let status="completed";
             if(scorm.data.score.raw!=null) {
               if(scorm.data.score.scaled>=scorm.data.score.passing)
                 status="passed";
               else
                 status="failed";
             }
             scorm.data.set(model.status, status);
          } else {
             scorm.data.set(model.status, "incomplete");
          }
          scorm.data.progress.measure=measure;
          scorm.data.set(model.progress, measure.toFixed(2).toString());
          scorm.data.progress.data=data;
          scorm.data.progress.location=location;
          if(data!=null) {
            scorm.data.set(model.suspend_data, data);
          }
          if(location!=null) {
            scorm.data.set(model.location, location);
          }
          if(scorm.data.progress.save) scorm.save();
        }
        return success;
    }

    /* -------------------------------------------------------------------------
       pipwerks.SCORM.data.get(parameter)
       Requests information from the LMS.

       Parameter: parameter (string, name of the SCORM data model element)
       Returns:   string or null on error
    ---------------------------------------------------------------------------- */

    pipwerks.SCORM.data.get = function(parameter) {

        let value = null,
            scorm = pipwerks.SCORM,
            trace = pipwerks.UTILS.trace,
            debug = scorm.debug,
            traceMsgPrefix = "SCORM.data.get('" + parameter + "') ",
            model=scorm.API.model;
        if(parameter=="") return null;
        if (scorm.connection.isActive) {

            let API = scorm.API.getHandle(),
                errorCode = 0;

            if (API) {
                value = scorm.API.GetValue.call(API,parameter);
                errorCode = debug.getCode();

                //GetValue returns an empty string on errors
                //If value is an empty string, check errorCode to make sure there are no errors
                if (value != "" || errorCode === 0) {

                    //GetValue is successful.
                    //If parameter is lesson_status/completion_status or exit status, let's
                    //grab the value and cache it so we can check it during connection.terminate()
                    if(parameter==model.status) {
                        scorm.data.completionStatus = value;
                    } else if(parameter==model.exit) {
                        scorm.data.exitStatus = value;
                    }
                } else {
                    value = null;
                    trace(traceMsgPrefix + "failed. \nError code: " + errorCode + "\nError info: " + debug.getInfo(errorCode));
                }
            } else {
                trace(traceMsgPrefix + "failed: API is null.");
            }
        } else {
            trace(traceMsgPrefix + "failed: API connection is inactive.");
        }
        trace(traceMsgPrefix + " value: " + value);
        return value;
    };


    /* -------------------------------------------------------------------------
       pipwerks.SCORM.data.set()
       Tells the LMS to assign the value to the named data model element.
       Also stores the SCO's completion status in a variable named
       pipwerks.SCORM.data.completionStatus. This variable is checked whenever
       pipwerks.SCORM.connection.terminate() is invoked.

       Parameters: parameter (string). The data model element
                   value (string). The value for the data model element
       Returns:    Boolean
    ---------------------------------------------------------------------------- */

    pipwerks.SCORM.data.set = function(parameter, value) {

        let success = false,
            scorm = pipwerks.SCORM,
            trace = pipwerks.UTILS.trace,
            makeBoolean = pipwerks.UTILS.StringToBoolean,
            debug = scorm.debug,
            traceMsgPrefix = "SCORM.data.set('" + parameter + "') ",
            model=scorm.API.model;

        if(parameter=="") return true;
        if (scorm.connection.isActive) {

            let API = scorm.API.getHandle(),
                errorCode = 0;

            if (API) {
                if(parameter==model.status && scorm.version=="2004") {
                  success=true;
                  if(value=="passed" || value=="failed") {
                    success = makeBoolean(scorm.API.SetValue.call(API,"cmi.success_status", value));
                  }
                  if(success) 
                    success = makeBoolean(scorm.API.SetValue.call(API,parameter, (value=="passed" || value=="failed")?"completed":value));
                } else {
                  success = makeBoolean(scorm.API.SetValue.call(API,parameter, value));
                }
                if (success) {
                    if (parameter === model.status) {
                        scorm.data.completionStatus = value;
                    }
                } else {
                    errorCode = debug.getCode();
                    trace(traceMsgPrefix + "failed. \nError code: " + errorCode + ". \nError info: " + debug.getInfo(errorCode));
                }

            } else {
                trace(traceMsgPrefix + "failed: API is null.");
            }

        } else {
            trace(traceMsgPrefix + "failed: API connection is inactive.");
        }

        trace(traceMsgPrefix + " value: " + value);
        return success;
    };


    /* -------------------------------------------------------------------------
       pipwerks.SCORM.data.save()
       Instructs the LMS to persist all data to this point in the session

       Parameters: None
       Returns:    Boolean
    ---------------------------------------------------------------------------- */

    pipwerks.SCORM.data.save = function() {

        let success = false,
            scorm = pipwerks.SCORM,
            trace = pipwerks.UTILS.trace,
            makeBoolean = pipwerks.UTILS.StringToBoolean,
            traceMsgPrefix = "SCORM.data.save failed";


        if (scorm.connection.isActive) {

            const API = scorm.API.getHandle();

            if (API) {
                success = makeBoolean(scorm.API.Commit.call(API,""));

            } else {

                trace(traceMsgPrefix + ": API is null.");

            }

        } else {

            trace(traceMsgPrefix + ": API connection is inactive.");

        }

        return success;

    };




    // ------------------------------------------------------------------------- //
    // --- pipwerks.SCORM.debug functions -------------------------------------- //
    // ------------------------------------------------------------------------- //


    /* -------------------------------------------------------------------------
       pipwerks.SCORM.debug.getCode
       Requests the error code for the current error state from the LMS

       Parameters: None
       Returns:    Integer (the last error code).
    ---------------------------------------------------------------------------- */

    pipwerks.SCORM.debug.getCode = function() {

        let scorm = pipwerks.SCORM,
            API = scorm.API.getHandle(),
            trace = pipwerks.UTILS.trace,
            code = 0;

        if (API) {

            code = parseInt(scorm.API.GetLastError.call(API), 10);

        } else {

            trace("SCORM.debug.getCode failed: API is null.");

        }

        return code;

    };


    /* -------------------------------------------------------------------------
       pipwerks.SCORM.debug.getInfo()
       "Used by a SCO to request the textual description for the error code
       specified by the value of [errorCode]."

       Parameters: errorCode (integer).
       Returns:    String.
    ----------------------------------------------------------------------------- */

    pipwerks.SCORM.debug.getInfo = function(errorCode) {

        let scorm = pipwerks.SCORM,
            API = scorm.API.getHandle(),
            trace = pipwerks.UTILS.trace,
            result = "";


        if (API) {

            result = scorm.API.GetErrorString.call(API,errorCode.toString());

        } else {

            trace("SCORM.debug.getInfo failed: API is null.");

        }

        return String(result);

    };


    /* -------------------------------------------------------------------------
       pipwerks.SCORM.debug.getDiagnosticInfo
       "Exists for LMS specific use. It allows the LMS to define additional
       diagnostic information through the API Instance."

       Parameters: errorCode (integer).
       Returns:    String (Additional diagnostic information about the given error code).
    ---------------------------------------------------------------------------- */

    pipwerks.SCORM.debug.getDiagnosticInfo = function(errorCode) {

        let scorm = pipwerks.SCORM,
            API = scorm.API.getHandle(),
            trace = pipwerks.UTILS.trace,
            result = "";

        if (API) {
            result = scorm.API.GetDiagnostic.call(API,errorCode);
        } else {
            trace("SCORM.debug.getDiagnosticInfo failed: API is null.");
        }

        return String(result);

    };


    // ------------------------------------------------------------------------- //
    // --- Shortcuts! ---------------------------------------------------------- //
    // ------------------------------------------------------------------------- //

    // Because nobody likes typing verbose code.

    pipwerks.SCORM.init = pipwerks.SCORM.connection.initialize;
    pipwerks.SCORM.get = pipwerks.SCORM.data.get;
    pipwerks.SCORM.set = pipwerks.SCORM.data.set;
    pipwerks.SCORM.save = pipwerks.SCORM.data.save;
    pipwerks.SCORM.quit = pipwerks.SCORM.connection.terminate;
    pipwerks.SCORM.setprogress = pipwerks.SCORM.data.setprogress;
    pipwerks.SCORM.setscore = pipwerks.SCORM.data.setscore;
    pipwerks.SCORM.setobjective = pipwerks.SCORM.data.setobjective;



    // ------------------------------------------------------------------------- //
    // --- pipwerks.UTILS functions -------------------------------------------- //
    // ------------------------------------------------------------------------- //

    /* -------------------------------------------------------------------------
       pipwerks.UTILS.SCORMTime2ms(tm)
       Convert the SCORM time to milliseconds

       Parameters:  tm (time as CMITimespan or timeinterval)
       Returns:     time interval in milliseconds
    ---------------------------------------------------------------------------- */

    pipwerks.UTILS.SCORMTime2ms=function(tm){
      let scorm = pipwerks.SCORM;
      const msperhour=60*60*1000;
      let ms=0;
      if(tm) {
        if(scorm.version=="2004") {
          let toMS=function(t, am, sfx){
            let r=t.match(new RegExp("([0-9]+)"+sfx));
            if(r) {
              ms=(+r[1])*am;
            }
          }
          let yt=tm.split('T');
          toMS(yt[0],365.25*24*msperhour,"Y");
          toMS(yt[0],365.25*2*msperhour,"M");
          toMS(yt[0],24*msperhour,"D");
          if(yt.length>1) {
            toMS(yt[1],msperhour,"H");
            toMS(yt[1],msperhour/60,"M");
            toMS(yt[1],1000,"S");
          }
        }
        else {
          let hms=tm.split(':');
          ms=(+hms[0])*msperhour+(+hms[1])*msperhour/60+(+hms[2])*1000;
        }
      }
      return ms;
    }

    /* -------------------------------------------------------------------------
       pipwerks.UTILS.ms2SCORMTime(tm)
       Convert time in milliseconds in CMITimespan or timeinterval

       Parameters:  tm (time in milliseconds)
       Returns:     time interval as CMITimespan or timeinterval
    ---------------------------------------------------------------------------- */
    pipwerks.UTILS.ms2SCORMTime=function(ms){
      let scorm = pipwerks.SCORM;
      const msperhour=60*60*100;
      let ScormTime="";
      let toScormTime=function(am,sfx,pad=0){
        let v=Math.floor(ms/am);
        ms-=v*am;
        if(v>0 || pad>0) ScormTime+=v.toString().padStart(pad,"0")+sfx;
      }
      ms=Math.floor(ms / 10);
      if(scorm.version=="2004") {
        toScormTime(365.25*24*msperhour,"Y");
        toScormTime(365.25*2*msperhour,"M");
        toScormTime(24*msperhour,"D");

        if(ms>0) ScormTime+="T";
        toScormTime(msperhour,"H");
        toScormTime(6000,"M");
        if(ms>0) {
          if(ms%100==0)
             ScormTime+=ms/100+"S";
          else
             ScormTime+=(ms/100).toFixed(2)+"S";
        }
        if (ScormTime == "") ScormTime = "0S";
        ScormTime="P"+ScormTime;
      }
      else {
        toScormTime(msperhour,":",4);
        toScormTime(6000,":",2);
        ScormTime+=(ms/100).toFixed(2).toString().padStart(5,"0");
      }
      return ScormTime;
    }



    /* -------------------------------------------------------------------------
       pipwerks.UTILS.StringToBoolean()
       Converts 'boolean strings' into actual valid booleans.

       (Most values returned from the API are the strings "true" and "false".)

       Parameters: String
       Returns:    Boolean
    ---------------------------------------------------------------------------- */

    pipwerks.UTILS.StringToBoolean = function(value) {
        let t = typeof value;
        switch (t) {
            //typeof new String("true") === "object", so handle objects as string via fall-through.
            //See https://github.com/pipwerks/scorm-api-wrapper/issues/3
            case "object":
            case "string":
                return (/(true|1)/i).test(value);
            case "number":
                return !!value;
            case "boolean":
                return value;
            case "undefined":
                return null;
            default:
                return false;
        }
    };


    /* -------------------------------------------------------------------------
       pipwerks.UTILS.trace()
       Displays error messages when in debug mode.

       Parameters: msg (string)
       Return:     None
    ---------------------------------------------------------------------------- */

    pipwerks.UTILS.trace = function(msg) {

        if (pipwerks.debug.isActive) {

            if (window.console && window.console.log) {
                window.console.log(msg);
            } else {
                //alert(msg);
            }

        }
    };

    return pipwerks;

}));
