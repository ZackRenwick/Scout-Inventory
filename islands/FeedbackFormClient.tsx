import { useEffect } from "preact/hooks";

export default function FeedbackFormClient() {
  useEffect(() => {
    const kindSelect = document.querySelector('select[name="kind"]');
    const photoSection = document.getElementById("photo-section");

    if (!(kindSelect instanceof HTMLSelectElement) || !(photoSection instanceof HTMLElement)) {
      return;
    }

    const photoInput = document.getElementById("photo-input");
    const photoPreview = document.getElementById("photo-preview");
    const previewImg = document.getElementById("preview-img");
    const photoIdInput = document.getElementById("photo-id-input");
    const clearBtn = document.getElementById("clear-photo-btn");
    const uploadStatus = document.getElementById("upload-status");
    const feedbackForm = document.getElementById("feedback-form");

    if (
      !(photoInput instanceof HTMLInputElement) ||
      !(photoPreview instanceof HTMLElement) ||
      !(previewImg instanceof HTMLImageElement) ||
      !(photoIdInput instanceof HTMLInputElement) ||
      !(clearBtn instanceof HTMLElement) ||
      !(uploadStatus instanceof HTMLElement) ||
      !(feedbackForm instanceof HTMLFormElement)
    ) {
      return;
    }

    let pendingFile: File | null = null;

    const updatePhotoSectionVisibility = () => {
      photoSection.style.display = kindSelect.value === "bug" ? "block" : "none";
      if (kindSelect.value !== "bug") {
        photoPreview.classList.add("hidden");
        photoInput.value = "";
        photoIdInput.value = "";
        uploadStatus.textContent = "";
        pendingFile = null;
      }
    };

    const onPhotoInputChange = (e: Event) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      const file = input.files?.[0];
      if (!file) {
        return;
      }

      pendingFile = file;
      uploadStatus.textContent = "Loading preview...";

      try {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result;
          if (typeof dataUrl !== "string") {
            uploadStatus.textContent = "Could not preview image";
            return;
          }
          previewImg.src = dataUrl;
          photoPreview.classList.remove("hidden");
          uploadStatus.textContent = "Ready to submit (will upload on submit)";
        };
        reader.readAsDataURL(file);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        alert("Could not load image: " + message);
        photoInput.value = "";
        uploadStatus.textContent = "";
        pendingFile = null;
      }
    };

    const onClearClick = () => {
      photoPreview.classList.add("hidden");
      photoInput.value = "";
      photoIdInput.value = "";
      uploadStatus.textContent = "";
      pendingFile = null;
    };

    const onFormSubmit = async (e: SubmitEvent) => {
      if (kindSelect.value !== "bug" || !pendingFile) {
        return;
      }

      e.preventDefault();
      uploadStatus.textContent = "Uploading...";

      try {
        const fd = new FormData();
        fd.append("photo", pendingFile);

        const res = await fetch("/api/feedback-photos", {
          method: "POST",
          body: fd,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const errorMessage =
            body && typeof body.error === "string"
              ? body.error
              : "Upload failed with status " + res.status;
          throw new Error(errorMessage);
        }

        const payload = await res.json();
        if (!payload || typeof payload.photoId !== "string") {
          throw new Error("Upload response missing photo ID");
        }

        photoIdInput.value = payload.photoId;
        uploadStatus.textContent = "Upload complete";
        pendingFile = null;
        feedbackForm.submit();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        uploadStatus.textContent = "Upload failed: " + message;
        photoPreview.classList.remove("hidden");
      }
    };

    kindSelect.addEventListener("change", updatePhotoSectionVisibility);
    photoInput.addEventListener("change", onPhotoInputChange);
    clearBtn.addEventListener("click", onClearClick);
    feedbackForm.addEventListener("submit", onFormSubmit);
    updatePhotoSectionVisibility();

    return () => {
      kindSelect.removeEventListener("change", updatePhotoSectionVisibility);
      photoInput.removeEventListener("change", onPhotoInputChange);
      clearBtn.removeEventListener("click", onClearClick);
      feedbackForm.removeEventListener("submit", onFormSubmit);
    };
  }, []);

  return null;
}