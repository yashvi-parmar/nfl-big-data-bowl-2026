# NFL Big Data Bowl 2026 – Receiver Separation Analysis

## Project Overview
**A data-driven approach to isolate how much separation a targeted receiver truly creates.**

The moment the quarterback releases the football, the play transforms into a race between the targeted receiver and the nearest defender. The receiver’s priority is to make the catch, and having separation at the moment the ball arrives can be the difference between a clean reception and an incompletion.

This project leverages NFL player tracking data to move beyond surface-level metrics and quantify *true* receiver separation. Our goal is to isolate how much separation is created by the receiver themselves, independent of scheme, coverage, and contextual factors.

We combine data engineering, exploratory analysis, and interactive visualizations to better understand route-running effectiveness and defender leverage throughout a play.

---

## Repository Structure
.
├── react-app/
├── notebooks/
├── data/
├── README.md


### `react-app/`
Contains the **React application used to run interactive visualizations**.  
This app renders route trajectories, defender proximity, and separation metrics over time to intuitively explore how plays develop.

### `notebooks/`
Contains **Jupyter notebooks** used for:
- Data cleaning and preprocessing  
- Feature engineering (e.g. defender distance, leverage, timing)  
- Exploratory data analysis  
- Prototyping separation metrics and models  

These notebooks form the analytical backbone of the project and inform the visualization layer.

### `data/`
Stores raw and processed datasets derived from NFL player tracking data.  
(Large or raw files may be excluded from version control.)

---

## Methodology (High-Level)
- Identify the **targeted receiver** on each play  
- Track the nearest defender and spatial relationships over time  
- Measure separation dynamically rather than at a single static moment  
- Control for context such as route type, coverage shell, and play timing  
- Visualize results to validate and interpret quantitative findings  

---

## Technologies Used
- **Python** (pandas, numpy, Jupyter)
- **React** for interactive visualizations
- **JavaScript** for frontend rendering


---

## Motivation
Traditional separation metrics often fail to capture *how* and *when* separation is created.  
By integrating temporal tracking data with visual tools, this project aims to provide a clearer, more nuanced picture of receiver performance that aligns with how coaches, analysts, and fans actually watch the game.

---

## Future Work
- Incorporate coverage classification and defender responsibility  
- Extend metrics to non-targeted receivers  
- Model separation relative to expected values by route and alignment  
- Deploy visualizations as a public-facing web application  

---

## Authors 
Esha Shah, Bhairavi Thalayasingam, Yashvi Parmar
NFL Big Data Bowl 2026 Project
