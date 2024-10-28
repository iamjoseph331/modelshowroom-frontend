// components/ImageUpload.js

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import Webcam from 'react-webcam'; // Import react-webcam
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
  const [imageTexts, setImageTexts] = useState([]); // To store image_text
  const [predefinedImages, setPredefinedImages] = useState([]); // List of pre-defined images
  const [mode, setMode] = useState('upload'); // 'upload', 'predefined', 'camera'
  
  // New state variables for camera control
  const [facingMode, setFacingMode] = useState('user'); // 'user' or 'environment'
  const [cameraActive, setCameraActive] = useState(false); // Whether the camera is active
  
  // Refs
  const imageRef = useRef(null);
  const webcamRef = useRef(null);
  const timerRef = useRef(null);
  
  // Backend API base URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:6370';
  
  // Pre-defined images array (ensure these images exist in the public/predefined-images/ folder)
  const predefinedImageList = [
    'image1.jpg',
    'image2.jpg',
    'image3.jpg',
    // Add more image filenames as needed
  ];

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
    setPredefinedImages(predefinedImageList); // Set pre-defined images
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

  // Handle selection of pre-defined image
  const handlePredefinedImageSelect = (e) => {
    const selectedImage = e.target.value;
    if (selectedImage === '') {
      // Reset to no image selected
      setImageFile(null);
      setImagePreview(null);
      setLogs('');
      setResults(null);
      setBoundingBoxes([]);
      setImageTexts([]);
      return;
    }

    // Set the selected image as the preview
    const imageUrl = `/predefined-images/${selectedImage}`; // Ensure these images are in the public/predefined-images/ folder
    setImagePreview(imageUrl);
    setImageFile(null); // Since it's not uploaded, set to null
    setLogs(`Selected pre-defined image "${selectedImage}"\n`);
    setResults(null);
    setBoundingBoxes([]);
    setImageTexts([]);
  };

  // Handle mode change
  const handleModeChange = (selectedMode) => {
    setMode(selectedMode);
    setImageFile(null);
    setImagePreview(null);
    setLogs('');
    setResults(null);
    setBoundingBoxes([]);
    setImageTexts([]);
    setFacingMode('user'); // Reset to front-facing camera
    setCameraActive(false); // Deactivate camera

    // Clear any existing timers when switching modes
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop webcam stream if active
    if (webcamRef.current && webcamRef.current.stream) {
      webcamRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // Start the camera
  const startCamera = () => {
    setCameraActive(true);
    setLogs((prev) => prev + 'Camera started.\n');
  };

  // Stop the camera
  const stopCamera = () => {
    setCameraActive(false);
    setLogs((prev) => prev + 'Camera stopped.\n');

    // Stop webcam stream
    if (webcamRef.current && webcamRef.current.stream) {
      webcamRef.current.stream.getTracks().forEach(track => track.stop());
    }

    // Clear image preview and results
    setImagePreview(null);
    setResults(null);
    setBoundingBoxes([]);
    setImageTexts([]);
  };

  // Switch camera between front and back
  const switchCamera = () => {
    setFacingMode((prevMode) => (prevMode === 'user' ? 'environment' : 'user'));
    setLogs((prev) => prev + `Switched to ${facingMode === 'user' ? 'back' : 'front'}-facing camera.\n`);
  };

  // Function to capture image from webcam and send to backend
  const captureAndSend = async () => {
    if (webcamRef.current && cameraActive) {
      const screenshot = webcamRef.current.getScreenshot();
      if (screenshot) {
        try {
          // Convert data URL to base64 string
          const base64Image = screenshot.split(',')[1];

          // Prepare payload
          const payload = {
            mdl_name: selectedModel,
            cv_task: selectedTask,
            image: base64Image,
            metadata: '', // Add metadata if needed
          };

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
          } else {
            setBoundingBoxes([]); // Ensure boundingBoxes is empty if not present
          }

          // Parse image_text from the response
          if (response.data.image_text) {
            setImageTexts(response.data.image_text);
          } else {
            setImageTexts([]); // Ensure imageTexts is empty if not present
          }
        } catch (error) {
          console.error('Error during prediction:', error);
          setLogs((prev) => prev + `Error: ${error.message}\n`);
          if (error.response && error.response.data) {
            setLogs((prev) => prev + JSON.stringify(error.response.data) + '\n');
          }
        }
      }
    }
  };

  // Start sending images every second when camera is active
  useEffect(() => {
    if (mode === 'camera' && cameraActive) {
      // Start interval
      timerRef.current = setInterval(captureAndSend, 1000); // 1000ms = 1s
      setLogs((prev) => prev + 'Image capture started (1 image/sec).\n');
    } else {
      // Clear interval if not in camera mode or camera is inactive
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setLogs((prev) => prev + 'Image capture stopped.\n');
      }
    }

    // Cleanup on component unmount or when dependencies change
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [mode, cameraActive, selectedModel, selectedTask]);

  // Stop webcam when not in camera mode
  useEffect(() => {
    if (mode !== 'camera' && webcamRef.current) {
      const stream = webcamRef.current.stream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
  }, [mode]);

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

    if (mode === 'camera') {
      setLogs((prev) => prev + 'Camera mode is active. Images are being sent automatically.\n');
      return; // In camera mode, images are sent automatically via setInterval
    }

    // Basic validations for upload and predefined modes
    if (!imagePreview) {
      setLogs((prev) => prev + 'Please upload or select an image.\n');
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
    setImageTexts([]); // Reset previous image_text

    try {
      let imageBase64 = '';

      if (imageFile) {
        // If an image was uploaded
        imageBase64 = await fileToBase64(imageFile);
      } else if (imagePreview) {
        // If a pre-defined image was selected
        const response = await fetch(imagePreview);
        const blob = await response.blob();
        imageBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result.split(',')[1]; // Remove the prefix
            resolve(base64data);
          };
          reader.onerror = () => {
            reject('Failed to convert image to base64');
          };
          reader.readAsDataURL(blob);
        });
      }

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
      } else {
        setBoundingBoxes([]); // Ensure boundingBoxes is empty if not present
      }

      // Parse image_text from the response
      if (response.data.image_text) {
        setImageTexts(response.data.image_text);
      } else {
        setImageTexts([]); // Ensure imageTexts is empty if not present
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
      if (imagePreview && typeof imagePreview === 'object') {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  return (
    <div>
      <h1>Model Showroom</h1>

      {/* Mode Selection Buttons */}
      <div className={styles.modeSelection}>
        <button
          className={`${styles.modeButton} ${mode === 'upload' ? 'active' : ''}`}
          onClick={() => handleModeChange('upload')}
        >
          Upload Image
        </button>
        <button
          className={`${styles.modeButton} ${mode === 'predefined' ? 'active' : ''}`}
          onClick={() => handleModeChange('predefined')}
        >
          Pre-defined Image
        </button>
        <button
          className={`${styles.modeButton} ${mode === 'camera' ? 'active' : ''}`}
          onClick={() => handleModeChange('camera')}
        >
          Camera Mode
        </button>
      </div>

      <div className={styles.container}>
        {/* Left Column: Upload/Pre-defined Image or Camera */}
        <div className={styles.leftColumn}>
          {mode === 'upload' && (
            <>
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
            </>
          )}

          {mode === 'predefined' && (
            <>
              {/* Pre-defined Image Selection */}
              <div className={styles.formGroup}>
                <label htmlFor="predefined-image-select">Choose a Pre-defined Image:</label>
                <select
                  id="predefined-image-select"
                  onChange={handlePredefinedImageSelect}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select an image
                  </option>
                  {predefinedImages.map((imgName, index) => (
                    <option key={index} value={imgName}>
                      {imgName}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {mode === 'camera' && (
            <>
              {/* Webcam Feed with Overlay */}
              {cameraActive && (
                <div className={styles.cameraContainer}>
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className={styles.webcamFeed}
                    videoConstraints={{
                      facingMode: facingMode, // 'user' or 'environment'
                      width: 300, // Square width
                      height: 300, // Square height
                    }}
                  />
                  {/* Overlay for Image Text */}
                  {imageTexts.length > 0 && (
                    <div className={styles.centeredTextOverlay}>
                      {imageTexts.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Camera Control Buttons */}
              <div className={styles.cameraControls}>
                {!cameraActive ? (
                  <button onClick={startCamera} className={styles.cameraButton}>
                    Start Camera
                  </button>
                ) : (
                  <>
                    <button onClick={stopCamera} className={`${styles.cameraButton} ${styles.stop}`}>
                      Stop Camera
                    </button>
                    <button onClick={switchCamera} className={`${styles.cameraButton} ${styles.switch}`}>
                      Switch Camera
                    </button>
                  </>
                )}
              </div>

              <p>Camera mode is active. Images are being sent once per second when the camera is started.</p>
              <p> We will store the images in cloud with restricted access for model improvement purposes.</p>
            </>
          )}

          {/* Image Preview with Bounding Boxes or Centered Text (for Upload and Pre-defined modes) */}
          {mode !== 'camera' && imagePreview && (
            <div className={styles.imagePreview}>
              <img
                src={imagePreview}
                alt="Selected Preview"
                className={styles.imagePreviewImg}
                ref={imageRef}
              />
              {/* Overlay Bounding Boxes or Centered Text */}
              {boundingBoxes.length > 0 ? (
                boundingBoxes.map((box, index) => {
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

                  // Get the corresponding image_text
                  const imageText = imageTexts[index] || '';

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
                      {imageText && <span className={styles.confidenceScore}>{imageText}</span>}
                    </div>
                  );
                })
              ) : (
                /* If no bounding boxes, display image_text at the center */
                imageTexts.length > 0 && (
                  <div className={styles.centeredTextOverlay}>
                    {imageTexts.join(', ')}
                  </div>
                )
              )}
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
              <button type="submit" className={styles.submitButton} disabled={loading || mode === 'camera'}>
                {loading ? (
                  <>
                    Processing...
                    <div className={styles.spinner}></div>
                  </>
                ) : mode === 'camera' ? (
                  'Camera Active'
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
