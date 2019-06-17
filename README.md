
# naksha-react-ui-legacy

## Deprecated use https://github.com/strandls/naksha-components-react instead

Naksha-react-ui is a ui library in react for better visualization of geohashes (from elasticsearch or https://github.com/strandls/naksha) on a map. It can be embedded into an existing react project (https://indiabiodiversity.org/observation/list?view=map) or can be used as a standalone system.

## Installation

Download the zip or clone the repository

```sh
cd naksha-react-ui
npm install
npm run build
```

```jsx
import { Component } from "react";
import Naksha from "naksha-react-ui";

class NakshaReactUIDemo extends Component {

  constructor(props) {
    super(props);
    this.state = {
      flag: false
    };
  }

  componentDidMount() {
    this.setState({
      flag: true
    });
  }

  map() {
    return (
      <Naksha.MapHolder
        url="http://localhost:8081/naksha/services/geohash-aggregation/observation/observation"
        location_field="location"
        map_container="map2"
        restrict_to_bounds={[[68, 5.75], [98, 37.5]]}
        url_response_geohash_field="geohashAggregation"
        url_response_filtered_geohash_field="viewFilteredGeohashAggregation"
        color_scheme="YlOrRd"
        no_legend_stops="6"
        is_legend_stops_data_driven={true}
      />
    );
  }

  render() {
    return (
      <div style={{ position: "relative" }}>
        {this.state.flag ? this.map() : null}
        <div id="map2" style={{ height: "-webkit-fill-available" }}></div>
      </div>
    );
  }
}

```

### Component and its properties

#### MapHolder

- **url** - GET url for geohash data (This can either be Naksha url or ElasticSearch url).
- **location_field** - the field which has geo_point location data.
- **map_container** - The id of div which will hold the map.
- **restrict_bounds** - The bounding box in which the view of map has to be restricted. (Optional)
- **url_response_geohash_field** - The field in the response data which has geohash aggregation of the form
  ```json
  "geohash-grid": {
    "buckets": [
      {
        "key": "t",
        "doc_count": 1200310
      },
      {
        "key": "w",
        "doc_count": 109702
      }
    ]
  }
  ```
- **url_response_filtered_geohash_field** - The field in the response data which has geohash filtered in some proportion to current visible boundary of map. (Optional)
- **color_scheme** - Legend color scheme. One of https://github.com/strandls/naksha-react-ui/blob/master/src/colorbrewer/colorbrewer.js.
- **no_legend_stops** - Number of buckets in which all buckets of response geohash aggregation will be merged into. Or number of legends(ranges) in which the view data will fall. Must be in the range 3-9.
- **is_legend_stops_data_driven** - True if we want to define legend range such that each range has nearly same number of buckets. False if we want to have equally distributed ranges.
- **on_click** - The function which should be called on clicking data square on map. (Optional)

#### IndiaBoundaries

Provide India boundaries to mapboxgl maps.

```jsx
import Naksha from "naksha-react-ui";

// map is new mapboxgl.Map
map.on("load", function() {
  Naksha.IndiaBoundaries(map);
});
```

#### Layers

Display map layers from https://github.com/strandls/naksha on a mapboxgl map. Demo- https://indiabiodiversity.org/map

#### NewLayerComponent

Ability to add new layers to https://github.com/strandls/naksha.


## License

Apache License 2.0
