function injectCursorStyles() {
  if (document.getElementById("twiliner-booking-widget-cursor-style")) return;

  const style = document.createElement("style");
  style.id = "twiliner-booking-widget-cursor-style";
  style.textContent = `
    [data-booking-widget="true"] .booking-form-item,
    [data-booking-widget="true"] .booking-form-item-split {
      cursor: default;
    }

    [data-booking-widget="true"] [data-booking-field="origin"],
    [data-booking-widget="true"] [data-booking-field="destination"],
    [data-booking-widget="true"] [data-booking-field="departure-date"],
    [data-booking-widget="true"] [data-booking-field="return-date"],
    [data-booking-widget="true"] [data-booking-passengers="minus"],
    [data-booking-widget="true"] [data-booking-passengers="plus"],
    [data-booking-widget="true"] [data-booking-toggle="trip-type"],
    [data-booking-widget="true"] [data-booking-submit="true"],
    [data-booking-widget="true"] .booking-calendar-nav,
    [data-booking-widget="true"] .booking-calendar-day.is-available {
      cursor: pointer;
    }

    [data-booking-widget="true"] [aria-disabled="true"],
    [data-booking-widget="true"] .booking-calendar-day.is-disabled,
    [data-booking-widget="true"] .booking-calendar-day.is-empty {
      cursor: default;
    }

    [data-booking-widget="true"][data-booking-api-unavailable="true"] *,
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-field],
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-field] *,
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-toggle],
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-toggle] *,
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-toggle-group],
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-toggle-group] *,
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-passengers-wrapper],
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-passengers-wrapper] *,
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-passengers],
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-passengers] * {
      cursor: default !important;
    }

    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-submit="true"],
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-submit="true"] *,
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-fallback="true"],
    [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-fallback="true"] * {
      cursor: pointer !important;
    }
  `;
  document.head.appendChild(style);
}
