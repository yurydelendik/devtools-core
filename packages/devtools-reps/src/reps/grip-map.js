/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Dependencies

const PropTypes = require("prop-types");
const {
  isGrip,
  wrapRender,
  getMoreEllipsisElement,
} = require("./rep-utils");
const PropRep = require("./prop-rep");
const { MODE } = require("./constants");
const { ModePropType } = require("./array");
const { lengthBubble } = require("./grip-array");

const dom = require("react-dom-factories");
const { span } = dom;

/**
 * Renders an map. A map is represented by a list of its
 * entries enclosed in curly brackets.
 */
GripMap.propTypes = {
  object: PropTypes.object,
  // @TODO Change this to Object.values once it's supported in Node's version of V8
  mode: ModePropType,
  isInterestingEntry: PropTypes.func,
  onDOMNodeMouseOver: PropTypes.func,
  onDOMNodeMouseOut: PropTypes.func,
  onInspectIconClick: PropTypes.func,
  title: PropTypes.string,
};

function GripMap(props) {
  let {
    mode,
    object,
  } = props;

  const config = {
    "data-link-actor-id": object.actor,
    className: "objectBox objectBox-object",
  };

  let leftBrace = " { ";
  let rightBrace = " }";
  if (mode === MODE.TINY) {
    leftBrace = " {";
    rightBrace = "}";
  }

  const propsArray = mode === MODE.TINY
    ? [getMoreEllipsisElement()]
    : safeEntriesIterator(props, object, maxLengthMap.get(mode));

  return (
    span(config,
      getTitle(props, object),
      span({
        className: "objectLeftBrace",
      }, leftBrace),
      ...propsArray,
      span({
        className: "objectRightBrace",
      }, rightBrace)
    )
  );
}

function getTitle(props, object) {
  const title = props.title || (object && object.class ? object.class : "Map");
  return span({
      className: "objectTitle"},
    title,
    lengthBubble({
      length: getLength(object),
      mode: props.mode,
      maxLengthByMode: maxLengthMap
    })
  );
}

function safeEntriesIterator(props, object, max) {
  max = (typeof max === "undefined") ? 3 : max;
  try {
    return entriesIterator(props, object, max);
  } catch (err) {
    console.error(err);
  }
  return [];
}

function entriesIterator(props, object, max) {
  // Entry filter. Show only interesting entries to the user.
  let isInterestingEntry = props.isInterestingEntry || ((type, value) => {
    return (
      type == "boolean" ||
      type == "number" ||
      (type == "string" && value.length != 0)
    );
  });

  let mapEntries = object.preview && object.preview.entries
    ? object.preview.entries : [];

  let indexes = getEntriesIndexes(mapEntries, max, isInterestingEntry);
  if (indexes.length < max && indexes.length < mapEntries.length) {
    // There are not enough entries yet, so we add uninteresting entries.
    indexes = indexes.concat(
      getEntriesIndexes(mapEntries, max - indexes.length, (t, value, name) => {
        return !isInterestingEntry(t, value, name);
      })
    );
  }

  let entries = getEntries(props, mapEntries, indexes);
  if (entries.length < getLength(object)) {
    // There are some undisplayed entries. Then display "…".
    entries.push(getMoreEllipsisElement());
  }

  return unfoldEntries(entries, props.mode);
}

function unfoldEntries(items) {
  return items.reduce((res, item, index) => {
    if (Array.isArray(item)) {
      res = res.concat(item);
    } else {
      res.push(item);
    }

    // Interleave commas between elements
    if (index !== items.length - 1) {
      res.push(", ");
    }
    return res;
  }, []);
}

/**
 * Get entries ordered by index.
 *
 * @param {Object} props Component props.
 * @param {Array} entries Entries array.
 * @param {Array} indexes Indexes of entries.
 * @return {Array} Array of PropRep.
 */
function getEntries(props, entries, indexes) {
  let {
    onDOMNodeMouseOver,
    onDOMNodeMouseOut,
    onInspectIconClick,
  } = props;

  // Make indexes ordered by ascending.
  indexes.sort(function (a, b) {
    return a - b;
  });

  return indexes.map((index, i) => {
    let [key, entryValue] = entries[index];
    let value = entryValue.value !== undefined ? entryValue.value : entryValue;

    return PropRep({
      name: key,
      equal: " \u2192 ",
      object: value,
      mode: MODE.TINY,
      onDOMNodeMouseOver,
      onDOMNodeMouseOut,
      onInspectIconClick,
    });
  });
}

/**
 * Get the indexes of entries in the map.
 *
 * @param {Array} entries Entries array.
 * @param {Number} max The maximum length of indexes array.
 * @param {Function} filter Filter the entry you want.
 * @return {Array} Indexes of filtered entries in the map.
 */
function getEntriesIndexes(entries, max, filter) {
  return entries
    .reduce((indexes, [key, entry], i) => {
      if (indexes.length < max) {
        let value = (entry && entry.value !== undefined) ? entry.value : entry;
        // Type is specified in grip's "class" field and for primitive
        // values use typeof.
        let type = (value && value.class ? value.class : typeof value).toLowerCase();

        if (filter(type, value, key)) {
          indexes.push(i);
        }
      }

      return indexes;
    }, []);
}

function getLength(grip) {
  return grip.preview.size || 0;
}

function supportsObject(grip, noGrip = false) {
  if (noGrip === true || !isGrip(grip)) {
    return false;
  }
  return (grip.preview && grip.preview.kind == "MapLike");
}

const maxLengthMap = new Map();
maxLengthMap.set(MODE.SHORT, 3);
maxLengthMap.set(MODE.LONG, 10);

// Exports from this module
module.exports = {
  rep: wrapRender(GripMap),
  supportsObject,
  maxLengthMap,
  getLength,
};
