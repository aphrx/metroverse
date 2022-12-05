import React from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import ReactTooltip from 'react-tooltip';
import ReactGA from 'react-ga';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

import { sortSystems } from '/lib/util.js';
import { INITIAL_SYSTEM, INITIAL_META } from '/lib/constants.js';

export class Start extends React.Component {

  constructor(props) {
    super(props);
    this.startRef = React.createRef();
    this.state = {
      geocoder: null,
      systemChoices: {}
    };
  }

  loadDefaultData() {
    if (this.props.database === null) {
      return;
    }

    const defaultSystemsCollection = collection(this.props.database, 'users/default/systems');
    const defaultSystemsQuery = query(defaultSystemsCollection);
    getDocs(defaultSystemsQuery)
      .then((systemsSnapshot) => {
        let sysChoices = [];
        systemsSnapshot.forEach(sDoc => sysChoices.push(sDoc.data()));
        this.setState({
          systemChoices: sysChoices
        });
      })
      .catch((error) => {
        console.log("Error getting documents: ", error);
      });
  }

  loadSystemData(systemId, userId) {
    const systemOwner = userId ? userId : this.state.settings.userId;
    const docString = `users/${systemOwner}/systems/${systemId}`
    let systemDoc = this.props.database.doc(docString);
    systemDoc.get().then((doc) => {
      if (doc) {
        const data = doc.data();
        if (data && data.map) {
          let systemChoices = JSON.parse(JSON.stringify(this.state.systemChoices));
          systemChoices[systemId] = data
          this.setState({
            systemChoices: systemChoices
          });
        }
      }
    }).catch((error) => {
      console.log('Unexpected Error:', error);
    });
  }

  selectSystem(id) {
    const meta = {
      systemId: this.getNextSystemId(),
      nextLineId: this.state.systemChoices[id].nextLineId,
      nextStationId: this.state.systemChoices[id].nextStationId
    }

    this.props.onSelectSystem(this.state.systemChoices[id].map, meta);

    ReactGA.event({
      category: 'Start',
      action: 'Select Default Map',
      value: parseInt(id)
    });
  }

  getNextSystemId() {
    if (this.props.settings && (this.props.settings.systemIds || []).length) {
      const intIds = this.props.settings.systemIds.map((a) => parseInt(a));
      return `${Math.max(...intIds) + 1}`;
    } else {
      return '0';
    }
  }

  renderDefaultChoices() {
    if (Object.keys(this.state.systemChoices).length) {
      let choices = [];
      for (const system of Object.values(this.state.systemChoices).sort(sortSystems)) {
        choices.push(
          <button className="Start-defaultChoice" key={system.systemId}
                  onClick={() => this.selectSystem(system.systemId)}>
            {system.map.title ? system.map.title : 'Unnamed System'}
          </button>
        );
      }
      return(
        <div className="Start-defaultChoices">
          {choices}
        </div>
      );
    }
    return '';
  }

  componentDidMount() {
    ReactTooltip.rebuild();
    this.loadDefaultData();

    let geocoder = new MapboxGeocoder({
      mapboxgl: mapboxgl,
      accessToken: mapboxgl.accessToken,
      placeholder: 'e.g. Berlin, Germany',
      types: 'place,district,region,country',
      getItemValue: (item) => {
        console.log(item)
        item.place_name
      }
    })

    this.startRef.current.appendChild(geocoder.onAdd(this.props.map));

    geocoder.on('result', (result) => {
      if (result.result.place_name) {
        let system = INITIAL_SYSTEM;
        system.title = result.result.place_name;

        let meta = INITIAL_META;
        meta.systemId = this.getNextSystemId();
        this.props.onSelectSystem(system, meta, result.result.bbox);

        ReactGA.event({
          category: 'Start',
          action: 'Select Custom Map'
        });
      }
    });

    this.setState({
      geocoder: geocoder
    });
  }

  render() {
    return (
      <div className="Start FadeAnim">
        <div className="Start-upper">
          <div className="Start-heading">
            Start from a Preset City
          </div>
          {this.renderDefaultChoices()}
        </div>
        <div className="Start-lower" ref={this.startRef}>
          <div className="Start-heading">
            Search for a Different City
          </div>
        </div>
      </div>
    );
  }
}
