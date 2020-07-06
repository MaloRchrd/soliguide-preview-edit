import React, { Fragment, useState, useEffect } from "react";
import { cursor } from "@airtable/blocks";
import { ViewType } from "@airtable/blocks/models";
import {
  initializeBlock,
  useBase,
  useRecordById,
  useLoadable,
  useSettingsButton,
  useWatchable,
  Box,
  Dialog,
  Heading,
  Link,
  Text,
  Button,
  TextButton,
} from "@airtable/blocks/ui";

import { useSettings } from "./settings";
import SettingsForm from "./SettingsForm";
function UrlPreviewBlock() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  useSettingsButton(() => setIsSettingsOpen(!isSettingsOpen));

  const { isValid } = useSettings();

  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);

  useLoadable(cursor);

  useWatchable(cursor, ["selectedRecordIds", "selectedFieldIds"], () => {
    if (cursor.selectedRecordIds.length > 0) {
      setSelectedRecordId(cursor.selectedRecordIds[0]);
    }
    if (cursor.selectedFieldIds.length > 0) {
      setSelectedFieldId(cursor.selectedFieldIds[0]);
    }
  });

  useWatchable(cursor, ["activeTableId", "activeViewId"], () => {
    setSelectedRecordId(null);
    setSelectedFieldId(null);
  });

  const base = useBase();
  const activeTable = base.getTableByIdIfExists(cursor.activeTableId);

  useEffect(() => {
    if (!isValid && !isSettingsOpen) {
      setIsSettingsOpen(true);
    }
  }, [isValid, isSettingsOpen]);

  if (!activeTable) {
    return null;
  }

  return (
    <Box>
      {isSettingsOpen ? (
        <SettingsForm setIsSettingsOpen={setIsSettingsOpen} />
      ) : (
        <RecordPreviewWithDialog
          activeTable={activeTable}
          selectedRecordId={selectedRecordId}
          selectedFieldId={selectedFieldId}
          setIsSettingsOpen={setIsSettingsOpen}
        />
      )}
    </Box>
  );
}

// Shows a preview, or a dialog that displays information about what
// kind of services (URLs) are supported by this block.
function RecordPreviewWithDialog({
  activeTable,
  selectedRecordId,
  selectedFieldId,
  setIsSettingsOpen,
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [soliguideEdit, setSoliguideEdit] = useState(false);

  return (
    <Fragment>
      <Box
        position="absolute"
        top={"5px"}
        left={0}
        right={0}
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
      >
        {!soliguideEdit ? (
          <Button
            onClick={() => setSoliguideEdit(true)}
            icon="edit"
            alignItems="center"
          >
            Edit
          </Button>
        ) : (
          <Button
            onClick={() => setSoliguideEdit(false)}
            icon="file"
            variant="primary"
          >
            Preview
          </Button>
        )}
      </Box>
      <Box
        position="absolute"
        top={"40px"}
        left={0}
        right={0}
        bottom={0}
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        borderTop="2px solid"
        borderColor={!soliguideEdit ? "grayLight2" : "blue"}
      >
        <RecordPreview
          activeTable={activeTable}
          selectedRecordId={selectedRecordId}
          selectedFieldId={selectedFieldId}
          setIsDialogOpen={setIsDialogOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          soliguideEdit={soliguideEdit}
        />
      </Box>
      {isDialogOpen && (
        <Dialog onClose={() => setIsDialogOpen(false)} maxWidth={400}>
          <Dialog.CloseButton />
          <Heading size="small">Supported services</Heading>
          <Text marginTop={2}>Previews are supported for these services:</Text>
          <Text marginTop={2}>Soliguide</Text>
          <Link
            marginTop={2}
            href="https://airtable.com/shrQSwIety6rqfJZX"
            target="_blank"
          >
            Request a new service
          </Link>
        </Dialog>
      )}
    </Fragment>
  );
}

// Shows a preview, or a message about what the user should do to see a preview.
function RecordPreview({
  activeTable,
  selectedRecordId,
  selectedFieldId,
  setIsDialogOpen,
  setIsSettingsOpen,
  soliguideEdit,
}) {
  const {
    settings: { isEnforced, urlField, urlTable },
  } = useSettings();

  const table = (isEnforced && urlTable) || activeTable;

  // We use getFieldByIdIfExists because the field might be deleted.
  const selectedField = selectedFieldId
    ? table.getFieldByIdIfExists(selectedFieldId)
    : null;
  // When using a specific field for previews is enabled and that field exists,
  // use the selectedField
  const previewField = (isEnforced && urlField) || selectedField;
  // Triggers a re-render if the record changes. Preview URL cell value
  // might have changed, or record might have been deleted.
  const selectedRecord = useRecordById(
    table,
    selectedRecordId ? selectedRecordId : "",
    {
      fields: [previewField],
    }
  );

  // Triggers a re-render if the user switches table or view.
  // RecordPreview may now need to render a preview, or render nothing at all.
  useWatchable(cursor, ["activeTableId", "activeViewId"]);

  // This button is re-used in two states so it's pulled out in a constant here.
  const viewSupportedURLsButton = (
    <TextButton
      size="small"
      marginTop={3}
      onClick={() => setIsDialogOpen(true)}
    >
      View supported URLs
    </TextButton>
  );

  if (
    // If there is/was a specified table enforced, but the cursor
    // is not presently in the specified table, display a message to the user.
    isEnforced &&
    cursor.activeTableId !== table.id
  ) {
    return (
      <Fragment>
        <Text paddingX={3}>
          Switch to the “{table.name}” table to see previews.
        </Text>
        <TextButton
          size="small"
          marginTop={3}
          onClick={() => setIsSettingsOpen(true)}
        >
          Settings
        </TextButton>
      </Fragment>
    );
  } else if (
    // activeViewId is briefly null when switching views
    cursor.activeViewId === null ||
    table.getViewById(cursor.activeViewId).type !== ViewType.GRID
  ) {
    return <Text>Switch to a grid view to see previews</Text>;
  } else if (
    // selectedRecord will be null on block initialization, after
    // the user switches table or view, or if it was deleted.
    selectedRecord === null ||
    // The selected field may have been deleted.
    selectedField === null
  ) {
    return (
      <Fragment>
        <Text>Cliquer sur une fiche pour lancer la prévisualisation</Text>
      </Fragment>
    );
  } else {
    // Using getCellValueAsString guarantees we get a string back. If
    // we use getCellValue, we might get back numbers, booleans, or
    // arrays depending on the field type.
    const cellValue = selectedRecord.getCellValueAsString(previewField);

    if (!cellValue) {
      return (
        <Fragment>
          <Text>The “{previewField.name}” field is empty</Text>
          {viewSupportedURLsButton}
        </Fragment>
      );
    } else {
      const previewUrl = getPreviewUrlForCellValue(cellValue);

      // In this case, the FIELD_NAME field of the currently selected
      // record either contains no URL, or contains a that cannot be
      // resolved to a supported preview.
      if (!previewUrl) {
        return (
          <Fragment>
            <Text>No preview</Text>
            {viewSupportedURLsButton}
          </Fragment>
        );
      } else {
        if (soliguideEdit) {
          let editUrl = previewUrl + "/edit";
          return (
            <iframe
              key={previewUrl}
              style={{ flex: "auto", width: "100%" }}
              src={editUrl}
              frameBorder="0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          );
        } else {
          return (
            <iframe
              key={previewUrl}
              style={{ flex: "auto", width: "100%" }}
              src={previewUrl}
              frameBorder="0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          );
        }
      }
    }
  }
}

function getPreviewUrlForCellValue(url) {
  if (!url) {
    return null;
  }
  for (const converter of converters) {
    const previewUrl = converter(url);
    if (previewUrl) {
      return previewUrl;
    }
  }
  // If no converter is found, return null.
  return null;
}

const converters = [
  function getSoliguidePreviewUrl(url) {
    if (url.match(/soliguide\.fr/)) {
      return `${url}`;
    }
    return null;
  },
  function getsitePreviewUrl(url) {
    if (url.match(/\d/gm)) {
      return `https://soliguide.fr/fiche/${url}`;
    }
  },
];

initializeBlock(() => <UrlPreviewBlock />);
