$(document).ready(function() {
	var resultArea = $('#resultArea');

	function lazyEscape(input) {
		// Cast to a string
		input = '' + input;

		// Remove junk, add quotes
		return '"' + input.replace(/"/g, '\\"') + '"';
	}

	function fancyTime(date) {
		var year = date.getFullYear();
		var month = date.getMonth() + 1;
		var days = date.getDate();

		var hours = date.getHours();
		var minutes = date.getMinutes()
		var seconds = date.getSeconds()

		if(month < 10) month = '0' + month;
		if(days < 10) days = '0' + days;
		if(hours < 10) hours = '0' + hours;
		if(minutes < 10) minutes = '0' + minutes;
		if(seconds < 10) seconds = '0' + seconds;

		return year + '/' + month + '/' + days + ' ' + hours + ':' + minutes + ':' + seconds;
	}

	var convertToHuman = {
		lastlogon: true,
		lastlogontimestamp: true,
		pwdlastset: true,
	};

	function handleFile(f) {
		JSZip.loadAsync(f)
			.then(function(zip) {
				// Create a container for the results
				var myCon = $('<div>', {
					class: 'alert alert-success'
				}).appendTo(resultArea);

				// Add the name of the file
				myCon.append($('<b>', {
					text: f.name
				}));

				// Add the name of the file
				var theList = $('<ul>').appendTo(myCon);

				// Process each entry in the ZIP:
				zip.forEach(function (relativePath, zipEntry) {
					console.log(zipEntry);

					var thisItem = $('<li>', {
						text: zipEntry.name
					}).appendTo(theList);

					var thisItemResults = $('<ul>')
						.appendTo(theList);

					var thisItemResultsStatus = $('<li>', {
						text: 'Loading...'
					}).appendTo(thisItemResults);

					function addErrorForThisEntry(err) {
						thisItemResults.empty();

						// Error
						thisItemResults.append($('<li>', {
							text: 'Error: ' + err
						}))
					}

					zipEntry.async('string')
						.then(function (content) {
							// Remove dodgy characters from start
							content = content.trim();

							// Update status
							thisItemResultsStatus.text('Trying to read JSON...');

							try {
								var theContent = JSON.parse(content);

								if(typeof(theContent) !== 'object') {
									addErrorForThisEntry('This is not a valid BloodHound file, expected an object, got ' + typeof(theContent));
									return;
								}

								function pullCSV(dataSet, dataSetName) {
									// Data type validation
									if(typeof(dataSet) != 'object' || !Array.isArray(dataSet)) return;

									var thisCurrentStatus = $('<li>', {
										text: 'Parsing ' + dataSetName
									}).appendTo(thisItemResults);

									setTimeout(function() {
										var seenProps = {};

										var allItems = [];

										for(var i=0; i<dataSet.length; ++i) {
											var thisItem = dataSet[i];

											// Only care about objects that contain properties
											if(typeof(thisItem) !== 'object' || typeof(thisItem.Properties) !== 'object') continue;

											// Grab properties
											var props = thisItem.Properties;

											// Push the props
											var toStore = {};
											allItems.push(toStore);

											// Process each prop for the csv
											for(var prop in props) {
												var lazyProp = lazyEscape(prop);
												seenProps[lazyProp] = true;
												toStore[lazyProp] = props[prop];

												if(convertToHuman.hasOwnProperty(prop)) {
													try {
														var niceDate = new Date(parseInt(props[prop]) * 1000);

														var humanProp = prop + '_human';
														seenProps[humanProp] = true;
														toStore[humanProp] = fancyTime(niceDate);
													} catch(e) {
														// do nothing
													}
												}
											}
										}

										// Generate a CSV
										var keyOrder = Object.keys(seenProps);
										keyOrder.sort();
										
										var theResult = keyOrder.join(',') + '\n';

										for(var i=0; i<allItems.length; ++i) {
											var thisItem = allItems[i];

											var myItemResults = [];
											for(var j=0; j<keyOrder.length; ++j) {
												var thisKey = keyOrder[j];

												myItemResults.push(lazyEscape(thisItem[thisKey]));
											}

											theResult += myItemResults.join(',') + '\n';
										}

										// Create the blob
										var blob = new Blob([theResult], {type: "text/plain;charset=utf-8"});

										// CSV is now generated, add a button to save it
										$('<button>', {
											class: 'btn btn-primary',
											text: 'Download CSV of ' + dataSetName
										}).appendTo(
											$('<li>').appendTo(thisItemResults)
										).click(function() {
											saveAs(blob, dataSetName + '.csv');
										});

										// Remove the status
										thisCurrentStatus.remove();
									}, 1);
								}

								// Remove results
								thisItemResults.empty();

								// Pull all CSVs
								pullCSV(theContent.computers, 'Computers');
								pullCSV(theContent.users, 'Users');
								pullCSV(theContent.groups, 'Groups');
								pullCSV(theContent.ous, 'OUs');
								pullCSV(theContent.gpos, 'GPOs');
								pullCSV(theContent.domains, 'Domains');

								console.log(theContent);
							} catch(e) {
								addErrorForThisEntry(e.message);
							}
						});

				});
			}, function (e) {
				resultArea.append($("<div>", {
					"class" : "alert alert-danger",
					text : "Error reading " + f.name + ": " + e.message
				}));
			});
	}

	$('#inputFileUpload').on('change', function(evt) {
		// Clear result area
		resultArea.empty();

		var files = evt.target.files;
		for (var i = 0; i < files.length; i++) {
			handleFile(files[i]);
		}
	})
});
