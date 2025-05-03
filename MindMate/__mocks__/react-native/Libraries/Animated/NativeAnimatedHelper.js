module.exports = {
    // Add any methods that might be used
    addListener: jest.fn(),
    removeListeners: jest.fn(),
    API: {
      createAnimatedNode: jest.fn(),
      startListeningToAnimatedNodeValue: jest.fn(),
      stopListeningToAnimatedNodeValue: jest.fn(),
      connectAnimatedNodes: jest.fn(),
      disconnectAnimatedNodes: jest.fn(),
      startAnimatingNode: jest.fn(),
      stopAnimation: jest.fn(),
      setAnimatedNodeValue: jest.fn(),
      setAnimatedNodeOffset: jest.fn(),
      flattenAnimatedNodeOffset: jest.fn(),
      extractAnimatedNodeOffset: jest.fn(),
      connectAnimatedNodeToView: jest.fn(),
      disconnectAnimatedNodeFromView: jest.fn(),
      dropAnimatedNode: jest.fn(),
      addAnimatedEventToView: jest.fn(),
      removeAnimatedEventFromView: jest.fn(),
    }
  };