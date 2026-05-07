document.addEventListener("DOMContentLoaded", function () {
  const widget = document.querySelector('[data-booking-widget="true"]');
  if (!widget) return;

  /**
   * Twiliner Booking Widget
   * 1. DOM Attribute
   * 2. Passagier Stepper
   * 3. Toggle Hin & Zurück
   * 4. Abfahrtsorte aus API
   * 5. Ankunftsorte aus API
   */

  const CONFIG = {
    apiBaseUrl: "https://data.nightride.com/api",
    bookingBaseUrl: "https://booking.twiliner.com/",
    operatorId: "a0cf1341-a01b-449d-b91f-17a1b4f84c44",
    currency: "CHF",
    minPassengers: 1,
    maxPassengers: 9,
    panelTransitionMs: 300,
    selectedTextColor: "#46288c"
  };

  const TEXT = {
    de: {
      choose: "Bitte wählen",
      chooseDate: "Datum",
      loading: "Wird geladen...",
      noDepartures: "Keine Abfahrtsorte verfügbar",
      noDestinations: "Keine Ankunftsorte verfügbar",
      selectOriginFirst: "Bitte zuerst einen Abfahrtsort wählen.",
      originApiError: "Die Abfahrtsorte konnten nicht geladen werden.",
      destinationApiError: "Die Ankunftsorte konnten nicht geladen werden.",
      directBooking: "Direkt im Buchungstool buchen"
    },
    en: {
      choose: "Please select",
      chooseDate: "Date",
      loading: "Loading...",
      noDepartures: "No departure places available",
      noDestinations: "No arrival places available",
      selectOriginFirst: "Please select a departure place first.",
      originApiError: "Departure places could not be loaded.",
      destinationApiError: "Arrival places could not be loaded.",
      directBooking: "Open booking tool directly"
    }
  };

  const API_LANGUAGE_MAP = {
    de: "de",
    en: "en"
  };

  /**
   * Wichtig:
   * Das ist KEINE hardcodierte Ortsliste für das Dropdown.
   * Die Orte kommen aus der API.
   *
   * Diese Map behalten wir vorerst nur, weil die bestehende Turnit-Linklogik
   * offenbar alte numerische City Codes verwendet.
   * In Schritt 9: Turnit Link prüfen wir, ob diese Codes weiterhin nötig sind.
   */
  const LEGACY_CITY_CODE_MAP = {
    zurich: "001",
    zuerich: "001",
    bern: "002",
    berne: "002",
    basel: "012",
    girona: "004",
    barcelona: "005",
    amsterdam: "006",
    rotterdam: "008",
    brussels: "009",
    luxembourg: "010"
  };

  const state = {
    language: getCurrentLanguage(),
    tripType: "roundtrip",
    passengers: 1,

    selectedOrigin: null,
    selectedDestination: null,
    selectedDepartureDate: null,
    selectedReturnDate: null,

    originPlaces: [],
    destinationPlaces: [],

    isLoadingOrigins: false,
    isLoadingDestinations: false,
    originLoaded: false,
    destinationLoaded: false,

    openPanel: null
  };

  const labels = TEXT[state.language] || TEXT.de;

  const els = {
    returnWrapper: widget.querySelector('[data-booking-return-wrapper="true"]'),

    toggle: widget.querySelector('[data-booking-toggle="trip-type"]'),
    toggleGroup: widget.querySelector('[data-booking-toggle-group="true"]'),
    toggleCircle: widget.querySelector('[data-booking-toggle-circle="true"]'),
    toggleRoundtripLabel: widget.querySelector('[data-booking-toggle-label="roundtrip"]'),
    toggleOnewayLabel: widget.querySelector('[data-booking-toggle-label="oneway"]'),

    passengerMinus: widget.querySelector('[data-booking-passengers="minus"]'),
    passengerValue: widget.querySelector('[data-booking-passengers="value"]'),
    passengerPlus: widget.querySelector('[data-booking-passengers="plus"]'),

    originField: widget.querySelector('[data-booking-field="origin"]'),
    originLabel: widget.querySelector('[data-booking-label="origin"]'),
    originDropdown: widget.querySelector('[data-booking-dropdown="origin"]'),

    destinationField: widget.querySelector('[data-booking-field="destination"]'),
    destinationLabel: widget.querySelector('[data-booking-label="destination"]'),
    destinationDropdown: widget.querySelector('[data-booking-dropdown="destination"]'),

    departureField: widget.querySelector('[data-booking-field="departure-date"]'),
    departureLabel: widget.querySelector('[data-booking-label="departure-date"]'),
    departureCalendar: widget.querySelector('[data-booking-calendar="departure"]'),

    returnField: widget.querySelector('[data-booking-field="return-date"]'),
    returnLabel: widget.querySelector('[data-booking-label="return-date"]'),
    returnCalendar: widget.querySelector('[data-booking-calendar="return"]'),

    submit: widget.querySelector('[data-booking-submit="true"]'),
    error: widget.querySelector('[data-booking-error="true"]'),
    fallback: widget.querySelector('[data-booking-fallback="true"]')
  };

  function getCurrentLanguage() {
    const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();

    if (htmlLang.startsWith("en")) return "en";
    if (htmlLang.startsWith("de")) return "de";

    const path = window.location.pathname.toLowerCase();

    if (path === "/en" || path.startsWith("/en/")) return "en";

    return "de";
  }

  function normalizeLookupKey(input) {
    return String(input || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function stripTrailingCountryCode(label) {
    return String(label || "").replace(/\s*\([A-Z]{2}\)\s*$/, "");
  }

  function setLabelPlaceholder(labelEl, text) {
    if (!labelEl) return;

    labelEl.textContent = text;
    labelEl.style.color = "";
  }

  function setLabelSelected(labelEl, text) {
    if (!labelEl) return;

    labelEl.textContent = text;
    labelEl.style.color = CONFIG.selectedTextColor;
  }

  function mapPlace(place) {
    const cleanedLabel = stripTrailingCountryCode(place.label);
    const lookupKeys = [
      normalizeLookupKey(cleanedLabel),
      normalizeLookupKey(place.name),
      normalizeLookupKey(place.key)
    ].filter(Boolean);

    let legacyCode = null;

    for (let i = 0; i < lookupKeys.length; i += 1) {
      if (LEGACY_CITY_CODE_MAP[lookupKeys[i]]) {
        legacyCode = LEGACY_CITY_CODE_MAP[lookupKeys[i]];
        break;
      }
    }

    return {
      value: legacyCode || place.id,
      apiId: place.id,
      label: cleanedLabel || place.label || place.name || "",
      cityName: place.name || cleanedLabel || place.label || "",
      raw: place
    };
  }

  function sortPlacesAlphabetically(places) {
    return places.slice().sort(function (a, b) {
      return String(a.label || "").localeCompare(String(b.label || ""), state.language, {
        sensitivity: "base"
      });
    });
  }

  async function apiGet(path, query) {
    const url = new URL(
      CONFIG.apiBaseUrl.replace(/\/$/, "") + "/" + path.replace(/^\//, "")
    );

    Object.keys(query || {}).forEach(function (key) {
      const value = query[key];

      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    });

    const controller = new AbortController();
    const timeout = window.setTimeout(function () {
      controller.abort();
    }, 10000);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function getPanelContent(panel) {
    if (!panel) return null;

    return (
      panel.querySelector(".dropdown-list-content") ||
      panel.querySelector(".dropdown-list-item") ||
      panel
    );
  }

  function preparePanel(panel) {
    if (!panel) return;

    panel.style.display = "none";
    panel.style.opacity = "0";
    panel.style.transform = "translateY(0.5rem)";
    panel.style.transition =
      "opacity " + CONFIG.panelTransitionMs + "ms ease-in-out, transform " + CONFIG.panelTransitionMs + "ms ease-in-out";
    panel.style.pointerEvents = "none";
  }

  function openPanel(panel) {
    if (!panel) return;

    if (state.openPanel && state.openPanel !== panel) {
      closePanel(state.openPanel, true);
    }

    state.openPanel = panel;

    panel.style.display = "block";
    panel.style.pointerEvents = "auto";

    window.requestAnimationFrame(function () {
      panel.style.opacity = "1";
      panel.style.transform = "translateY(0)";
    });
  }

  function closePanel(panel, instant) {
    if (!panel) return;

    if (state.openPanel === panel) {
      state.openPanel = null;
    }

    if (instant) {
      panel.style.opacity = "0";
      panel.style.transform = "translateY(0.5rem)";
      panel.style.pointerEvents = "none";
      panel.style.display = "none";
      return;
    }

    panel.style.opacity = "0";
    panel.style.transform = "translateY(0.5rem)";
    panel.style.pointerEvents = "none";

    window.setTimeout(function () {
      if (state.openPanel !== panel) {
        panel.style.display = "none";
      }
    }, CONFIG.panelTransitionMs);
  }

  function togglePanel(panel) {
    if (!panel) return;

    const isOpen = state.openPanel === panel && panel.style.display !== "none";

    if (isOpen) {
      closePanel(panel);
    } else {
      openPanel(panel);
    }
  }

  function closeAllPanels() {
    closePanel(els.originDropdown);
    closePanel(els.destinationDropdown);
    closePanel(els.departureCalendar);
    closePanel(els.returnCalendar);
  }

  function setElementDisabled(el, isDisabled) {
    if (!el) return;

    el.style.opacity = isDisabled ? "0.4" : "";
    el.style.pointerEvents = isDisabled ? "none" : "";
    el.setAttribute("aria-disabled", isDisabled ? "true" : "false");
  }

  function setFieldLoading(field, isLoading) {
    if (!field) return;

    field.style.opacity = isLoading ? "0.6" : "";
    field.style.pointerEvents = isLoading ? "none" : "";
  }

  function setFieldEnabled(field, isEnabled) {
    if (!field) return;

    field.style.opacity = isEnabled ? "" : "0.4";
    field.style.pointerEvents = isEnabled ? "" : "none";
    field.setAttribute("aria-disabled", isEnabled ? "false" : "true");
  }

  function showError(message) {
    if (!els.error) return;

    els.error.textContent = message;
    els.error.style.display = "block";
  }

  function hideError() {
    if (!els.error) return;

    els.error.style.display = "none";
  }

  function showFallback() {
    if (!els.fallback) return;

    els.fallback.textContent = labels.directBooking;
    els.fallback.style.display = "inline-block";
    els.fallback.setAttribute("href", CONFIG.bookingBaseUrl);
  }

  function hideFallback() {
    if (!els.fallback) return;

    els.fallback.style.display = "none";
  }

  function renderPassengers() {
    if (!els.passengerValue) return;

    els.passengerValue.textContent = String(state.passengers);

    setElementDisabled(
      els.passengerMinus,
      state.passengers <= CONFIG.minPassengers
    );

    setElementDisabled(
      els.passengerPlus,
      state.passengers >= CONFIG.maxPassengers
    );
  }

  function increasePassengers(event) {
    if (event) event.preventDefault();

    if (state.passengers >= CONFIG.maxPassengers) return;

    state.passengers += 1;
    renderPassengers();
  }

  function decreasePassengers(event) {
    if (event) event.preventDefault();

    if (state.passengers <= CONFIG.minPassengers) return;

    state.passengers -= 1;
    renderPassengers();
  }

  function renderTripType() {
    const isOneway = state.tripType === "oneway";

    if (els.returnWrapper) {
      els.returnWrapper.style.display = isOneway ? "none" : "";
    }

    if (els.toggleRoundtripLabel) {
      els.toggleRoundtripLabel.style.color = isOneway
        ? "rgb(167, 167, 167)"
        : "rgb(255, 255, 255)";
    }

    if (els.toggleOnewayLabel) {
      els.toggleOnewayLabel.style.color = isOneway
        ? "rgb(255, 255, 255)"
        : "rgb(167, 167, 167)";
    }

    widget.setAttribute("data-booking-trip-type", state.tripType);
  }

  function toggleTripType(event) {
    if (event) event.preventDefault();

    state.tripType = state.tripType === "roundtrip" ? "oneway" : "roundtrip";

    if (state.tripType === "oneway") {
      state.selectedReturnDate = null;
      setLabelPlaceholder(els.returnLabel, labels.chooseDate);
      closePanel(els.returnCalendar, true);
    }

    renderTripType();
  }

  function renderDropdownOptions(panel, options, onSelect, emptyText) {
    const content = getPanelContent(panel);
    if (!content) return;

    content.innerHTML = "";

    if (!options.length) {
      const emptyItem = document.createElement("div");
      emptyItem.className = "dropdown-item";
      emptyItem.textContent = emptyText || labels.noDepartures;
      emptyItem.style.cursor = "default";
      content.appendChild(emptyItem);
      return;
    }

    options.forEach(function (option) {
      const item = document.createElement("div");
      item.className = "dropdown-item";
      item.textContent = option.label;
      item.setAttribute("role", "option");
      item.setAttribute("tabindex", "0");

      item.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        onSelect(option);
      });

      item.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(option);
        }
      });

      content.appendChild(item);
    });
  }

  function resetDestination() {
    state.selectedDestination = null;
    state.destinationPlaces = [];
    state.destinationLoaded = false;

    setLabelPlaceholder(els.destinationLabel, labels.choose);
    renderDropdownOptions(
      els.destinationDropdown,
      [],
      function () {},
      labels.noDestinations
    );

    setFieldEnabled(els.destinationField, false);
    closePanel(els.destinationDropdown, true);
  }

  function resetDates() {
    state.selectedDepartureDate = null;
    state.selectedReturnDate = null;

    setLabelPlaceholder(els.departureLabel, labels.chooseDate);
    setLabelPlaceholder(els.returnLabel, labels.chooseDate);

    closePanel(els.departureCalendar, true);
    closePanel(els.returnCalendar, true);
  }

  async function setOrigin(origin) {
    state.selectedOrigin = origin;

    setLabelSelected(els.originLabel, origin.label);

    hideError();
    closePanel(els.originDropdown);

    resetDestination();
    resetDates();

    await loadDestinationPlaces();
  }

  function setDestination(destination) {
    state.selectedDestination = destination;

    setLabelSelected(els.destinationLabel, destination.label);

    hideError();
    closePanel(els.destinationDropdown);

    resetDates();
  }

  async function loadDeparturePlaces() {
    if (state.isLoadingOrigins || state.originLoaded) return;

    state.isLoadingOrigins = true;

    setFieldLoading(els.originField, true);

    if (!state.selectedOrigin) {
      setLabelPlaceholder(els.originLabel, labels.loading);
    }

    try {
      const apiLanguage = API_LANGUAGE_MAP[state.language] || "de";

      const payload = await apiGet("get-places", {
        type: "departure",
        language: apiLanguage,
        operator_id: CONFIG.operatorId
      });

      const places = Array.isArray(payload)
        ? payload.map(mapPlace).filter(function (place) {
            return Boolean(place.label && place.apiId);
          })
        : [];

      state.originPlaces = sortPlacesAlphabetically(places);
      state.originLoaded = true;

      renderDropdownOptions(
        els.originDropdown,
        state.originPlaces,
        setOrigin,
        labels.noDepartures
      );

      if (!state.selectedOrigin) {
        setLabelPlaceholder(els.originLabel, labels.choose);
      }
    } catch (error) {
      console.error("Twiliner origin API error:", error);

      showError(labels.originApiError);
      showFallback();

      if (!state.selectedOrigin) {
        setLabelPlaceholder(els.originLabel, labels.choose);
      }
    } finally {
      state.isLoadingOrigins = false;
      setFieldLoading(els.originField, false);
    }
  }

  async function loadDestinationPlaces() {
    if (!state.selectedOrigin) {
      resetDestination();
      return;
    }

    state.isLoadingDestinations = true;
    state.destinationLoaded = false;

    setFieldLoading(els.destinationField, true);
    setLabelPlaceholder(els.destinationLabel, labels.loading);

    try {
      const apiLanguage = API_LANGUAGE_MAP[state.language] || "de";

      const payload = await apiGet("get-places", {
        type: "arrival",
        language: apiLanguage,
        operator_id: CONFIG.operatorId,
        place_departure_id: state.selectedOrigin.apiId
      });

      const places = Array.isArray(payload)
        ? payload.map(mapPlace).filter(function (place) {
            return Boolean(place.label && place.apiId);
          })
        : [];

      state.destinationPlaces = sortPlacesAlphabetically(places);
      state.destinationLoaded = true;

      renderDropdownOptions(
        els.destinationDropdown,
        state.destinationPlaces,
        setDestination,
        labels.noDestinations
      );

      setLabelPlaceholder(els.destinationLabel, labels.choose);
      setFieldEnabled(els.destinationField, state.destinationPlaces.length > 0);
    } catch (error) {
      console.error("Twiliner destination API error:", error);

      showError(labels.destinationApiError);
      showFallback();

      setLabelPlaceholder(els.destinationLabel, labels.choose);
      setFieldEnabled(els.destinationField, false);
    } finally {
      state.isLoadingDestinations = false;
      setFieldLoading(els.destinationField, false);

      if (!state.destinationPlaces.length) {
        setFieldEnabled(els.destinationField, false);
      }
    }
  }

  async function handleOriginClick(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    hideError();

    await loadDeparturePlaces();

    if (state.originLoaded) {
      togglePanel(els.originDropdown);
    }
  }

  function handleDestinationClick(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    hideError();

    if (!state.selectedOrigin) {
      showError(labels.selectOriginFirst);
      return;
    }

    if (!state.destinationLoaded || !state.destinationPlaces.length) {
      return;
    }

    togglePanel(els.destinationDropdown);
  }

  function bindEvents() {
    if (els.passengerMinus) {
      els.passengerMinus.addEventListener("click", decreasePassengers);
    }

    if (els.passengerPlus) {
      els.passengerPlus.addEventListener("click", increasePassengers);
    }

    if (els.toggle) {
      els.toggle.addEventListener("click", toggleTripType);
    }

    if (els.toggleRoundtripLabel) {
      els.toggleRoundtripLabel.addEventListener("click", function (event) {
        event.preventDefault();
        state.tripType = "roundtrip";
        renderTripType();
      });
    }

    if (els.toggleOnewayLabel) {
      els.toggleOnewayLabel.addEventListener("click", function (event) {
        event.preventDefault();
        state.tripType = "oneway";
        state.selectedReturnDate = null;
        setLabelPlaceholder(els.returnLabel, labels.chooseDate);
        closePanel(els.returnCalendar, true);
        renderTripType();
      });
    }

    if (els.originField) {
      els.originField.addEventListener("click", handleOriginClick);
    }

    if (els.destinationField) {
      els.destinationField.addEventListener("click", handleDestinationClick);
    }

    if (els.submit) {
      els.submit.addEventListener("click", function (event) {
        event.preventDefault();
      });
    }

    document.addEventListener("click", function (event) {
      if (!widget.contains(event.target)) {
        closeAllPanels();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeAllPanels();
      }
    });
  }

  function init() {
    preparePanel(els.originDropdown);
    preparePanel(els.destinationDropdown);
    preparePanel(els.departureCalendar);
    preparePanel(els.returnCalendar);

    hideError();
    hideFallback();

    resetDestination();
    resetDates();

    const currentPassengerValue = parseInt(
      els.passengerValue ? els.passengerValue.textContent.trim() : "",
      10
    );

    if (Number.isFinite(currentPassengerValue)) {
      state.passengers = Math.min(
        Math.max(currentPassengerValue, CONFIG.minPassengers),
        CONFIG.maxPassengers
      );
    }

    bindEvents();
    renderPassengers();
    renderTripType();

    window.TwilinerBookingWidgetDebug = {
      config: CONFIG,
      state,
      elements: els,
      loadDeparturePlaces,
      loadDestinationPlaces
    };
  }

  init();
});
