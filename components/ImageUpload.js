// components/ImageUpload.js

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import styles from './ImageUpload.module.css'; // Ensure correct path

const ImageUpload = () => {
  // State management
  const [tasks, setTasks] = useState({});
  const [selectedTask, setSelectedTask] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [metadataFile, setMetadataFile] = useState(null);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(false);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const [scores, setScores] = useState([]); // To store confidence scores

  // Ref to access the image DOM element
  const imageRef = useRef(null);

  // Backend API base URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

  // Fetch available tasks and models from the backend on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/getmodels`);
        setTasks(response.data || {});
        // Automatically select the first task and its first model
        const taskNames = Object.keys(response.data || {});
        if (taskNames.length > 0) {
          setSelectedTask(taskNames[0]);
          const firstModel = response.data[taskNames[0]][0];
          setSelectedModel(firstModel || '');
        }
      } catch (error) {
        console.error('Error fetching models:', error);
        setLogs((prev) => prev + `Error fetching models: ${error.message}\n`);
      }
    };

    fetchModels();
  }, [API_BASE_URL]);

  // Update selectedModel when selectedTask changes
  useEffect(() => {
    if (selectedTask && tasks[selectedTask]) {
      setSelectedModel(tasks[selectedTask][0] || '');
    }
  }, [selectedTask, tasks]);

  // Handle image drop via react-dropzone
  const onDrop = (acceptedFiles, fileRejections) => {
    // Handle rejected files
    if (fileRejections.length > 0) {
      fileRejections.forEach((rejection) => {
        rejection.errors.forEach((error) => {
          setLogs((prev) => prev + `Skipped "${rejection.file.name}" because ${error.message}\n`);
        });
      });
    }

    // Handle accepted files
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setImageFile(file);
      setLogs((prev) => prev + `Accepted "${file.name}"\n`);

      // Generate image preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      // Add other image MIME types if needed
    },
    multiple: false,
  });

  // Handle metadata upload (optional)
  const handleMetadataUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setMetadataFile(file);
      setLogs((prev) => prev + `Metadata file "${file.name}" selected.\n`);
    }
  };

  // Convert file to base64 string
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve('');
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]); // Remove the prefix
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();

    // Basic validations
    if (!imageFile) {
      setLogs((prev) => prev + 'Please upload an image.\n');
      return;
    }

    if (!selectedTask) {
      setLogs((prev) => prev + 'Please select a task.\n');
      return;
    }

    if (!selectedModel) {
      setLogs((prev) => prev + 'Please select a model.\n');
      return;
    }

    setLoading(true);
    setLogs('');
    setResults(null);
    setBoundingBoxes([]); // Reset previous bounding boxes
    setScores([]); // Reset previous scores

    try {
      // Convert image and metadata to appropriate formats
      const imageBase64 = await fileToBase64(imageFile);
      let metadataContent = '';

      if (metadataFile) {
        const reader = new FileReader();
        metadataContent = await new Promise((resolve, reject) => {
          reader.readAsText(metadataFile);
          reader.onload = () => resolve(reader.result);
          reader.onerror = (error) => reject(error);
        });
      }

      // Prepare payload
      const payload = {
        mdl_name: selectedModel,
        cv_task: selectedTask,
        image: imageBase64,
        metadata: metadataContent,
      };

      setLogs((prev) => prev + 'Sending prediction request...\n');

      // Send POST request to backend
      const response = await axios.post(`${API_BASE_URL}/api/predict`, payload);

      setResults(response.data);
      setLogs((prev) => prev + 'Prediction successful.\n');

      // Parse bounding boxes from the response
      if (response.data.bounding_box) {
        const parsedBoxes = response.data.bounding_box.map((box) => {
          if (Array.isArray(box) && box.length === 2) {
            const topLeft = box[0];
            const bottomRight = box[1];
            return {
              x1: topLeft.x,
              y1: topLeft.y,
              x2: bottomRight.x,
              y2: bottomRight.y,
            };
          }
          return null;
        }).filter(box => box !== null);

        setBoundingBoxes(parsedBoxes);
      }

      // Parse scores from the response
      if (response.data.scores) {
        setScores(response.data.scores);
      }
    } catch (error) {
      console.error('Error during prediction:', error);
      setLogs((prev) => prev + `Error: ${error.message}\n`);
      if (error.response && error.response.data) {
        setLogs((prev) => prev + JSON.stringify(error.response.data) + '\n');
      }
    } finally {
      setLoading(false);
    }
  };

  // Clean up the image preview URL when the component unmounts or when a new image is uploaded
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  return (
    <div>
      <h1>Model Showroom</h1>

      <div className={styles.container}>
        {/* Left Column: Drag-and-Drop Area and Image Preview */}
        <div className={styles.leftColumn}>
          {/* Drag-and-Drop Area */}
          <div {...getRootProps()} className={styles.dragDropArea}>
            <input {...getInputProps()} />
            {isDragActive ? (
              <p>Drop the image here ...</p>
            ) : (
              <p>Drag 'n' drop an image here, or click to select one</p>
            )}
          </div>
          {imageFile && (
            <div>
              <strong>Selected Image:</strong> {imageFile.name}
            </div>
          )}

          {/* Image Preview with Bounding Boxes */}
          {imagePreview && (
            <div className={styles.imagePreview}>
              <img
                src={imagePreview}
                alt="Selected Preview"
                className={styles.imagePreviewImg}
                ref={imageRef}
              />
              {/* Overlay Bounding Boxes */}
              {boundingBoxes.map((box, index) => {
                const img = imageRef.current;
                if (!img) return null;

                // Get the displayed image dimensions
                const { width: imgWidth, height: imgHeight } = img.getBoundingClientRect();

                // Calculate scaling factors based on the natural size vs displayed size
                const naturalWidth = img.naturalWidth;
                const naturalHeight = img.naturalHeight;
                const scaleX = imgWidth / naturalWidth;
                const scaleY = imgHeight / naturalHeight;

                // Calculate top-left corner and dimensions
                const x = box.x1 * scaleX;
                const y = box.y1 * scaleY;
                const width = (box.x2 - box.x1) * scaleX;
                const height = (box.y2 - box.y1) * scaleY;

                // Optional: Get the corresponding score
                const score = scores[index] ? scores[index].toFixed(2) : '';

                return (
                  <div
                    key={index}
                    className={styles.boundingBox}
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      width: `${width}px`,
                      height: `${height}px`,
                    }}
                  >
                    {score && <span className={styles.confidenceScore}>{score}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Form Controls, Logs, and Results */}
        <div className={styles.rightColumn}>
          <form onSubmit={handleSubmit} className={styles.formGroup}>
            {/* Task Selection */}
            <div className={styles.formGroup}>
              <label htmlFor="task-select">Task:</label>
              <select
                id="task-select"
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                required
              >
                {Object.keys(tasks).length > 0 ? (
                  Object.keys(tasks).map((task, index) => (
                    <option key={index} value={task}>
                      {task.replace('_', ' ').toUpperCase()}
                    </option>
                  ))
                ) : (
                  <option disabled>Loading tasks...</option>
                )}
              </select>
            </div>

            {/* Model Selection */}
            <div className={styles.formGroup}>
              <label htmlFor="model-select">Model:</label>
              <select
                id="model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                required
              >
                {selectedTask && tasks[selectedTask] ? (
                  tasks[selectedTask].length > 0 ? (
                    tasks[selectedTask].map((model, index) => (
                      <option key={index} value={model}>
                        {model}
                      </option>
                    ))
                  ) : (
                    <option disabled>No models available for this task</option>
                  )
                ) : (
                  <option disabled>Select a task first</option>
                )}
              </select>
            </div>

            {/* Metadata Upload (Optional) */}
            <div className={styles.formGroup}>
              <label htmlFor="metadata-upload">Metadata (JSON):</label>
              <input
                id="metadata-upload"
                type="file"
                accept="application/json"
                onChange={handleMetadataUpload}
              />
              {metadataFile && (
                <div>
                  <strong>Selected Metadata:</strong> {metadataFile.name}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className={styles.formGroup}>
              <button type="submit" className={styles.submitButton} disabled={loading}>
                {loading ? (
                  <>
                    Processing...
                    <div className={styles.spinner}></div>
                  </>
                ) : (
                  'Upload and Predict'
                )}
              </button>
            </div>
          </form>

          {/* Logs */}
          <div className={styles.logs}>
            <h2>Logs</h2>
            <pre>{logs}</pre>
          </div>

          {/* Results */}
          {results && (
            <div className={styles.results}>
              <h2>Results</h2>
              <pre>{JSON.stringify(results, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageUpload;
